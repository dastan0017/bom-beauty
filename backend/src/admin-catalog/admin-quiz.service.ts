import { Injectable } from '@nestjs/common';
import type { AdminQuiz, QuizInput } from '@bom/shared';
import { AuditService } from '../audit/audit.service';
import { loadQuizConfig } from '../catalog/quiz-config';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidateService, SITE_TAGS } from '../revalidate/revalidate.service';
import type { Actor } from './admin-products.service';

/**
 * «Подбор в тесте»: the quiz's goals and skin types (D47). A save replaces both lists: items match by key, a missing key
 * deletes the item. Programs lose a deleted goal (the foreign key sets it to null) and a deleted skin type (removed
 * from their lists here).
 */
@Injectable()
export class AdminQuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidator: RevalidateService,
  ) {}

  async get(): Promise<AdminQuiz> {
    const [config, programs] = await Promise.all([
      loadQuizConfig(this.prisma),
      this.prisma.program.findMany({ select: { quizGoal: true, quizSkins: true } }),
    ]);
    return {
      goals: config.goals.map((goal) => ({
        ...goal,
        programCount: programs.filter((program) => program.quizGoal === goal.key).length,
      })),
      skins: config.skins.map((skin) => ({
        ...skin,
        programCount: programs.filter((program) => program.quizSkins.includes(skin.key)).length,
      })),
    };
  }

  async save(input: QuizInput, actor: Actor): Promise<AdminQuiz> {
    const goalKeys = input.goals.map((goal) => goal.key);
    const skinKeys = input.skins.map((skin) => skin.key);
    const removed = await this.prisma.$transaction(async (tx) => {
      const goneGoals = await tx.quizGoal.findMany({
        where: { key: { notIn: goalKeys } },
        select: { key: true },
      });
      const goneSkins = await tx.skinType.findMany({
        where: { key: { notIn: skinKeys } },
        select: { key: true },
      });
      for (const { key } of goneSkins) {
        await tx.$executeRaw`UPDATE "programs" SET "quiz_skins" = array_remove("quiz_skins", ${key}) WHERE ${key} = ANY("quiz_skins")`;
      }
      await tx.quizGoal.deleteMany({ where: { key: { notIn: goalKeys } } });
      await tx.skinType.deleteMany({ where: { key: { notIn: skinKeys } } });
      for (const [order, { key, ...goal }] of input.goals.entries()) {
        await tx.quizGoal.upsert({
          where: { key },
          create: { key, ...goal, order },
          update: { ...goal, order },
        });
      }
      for (const [order, { key, ...skin }] of input.skins.entries()) {
        await tx.skinType.upsert({
          where: { key },
          create: { key, ...skin, order },
          update: { ...skin, order },
        });
      }
      return { goals: goneGoals.map((g) => g.key), skins: goneSkins.map((s) => s.key) };
    });
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'quiz',
      entityId: 'quiz',
      action: 'update',
      diff: { goals: goalKeys, skins: skinKeys, removed },
    });
    // The quiz is part of the layout data of every page; program cards carry the keys.
    this.revalidator.revalidate([SITE_TAGS.programs]);
    return this.get();
  }
}
