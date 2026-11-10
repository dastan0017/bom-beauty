import type { QuizConfig } from '@bom/shared';
import type { PrismaService } from '../prisma/prisma.service';

/** The owner's quiz goals and skin types with their rules, in her order (D47). */
export async function loadQuizConfig(prisma: PrismaService): Promise<QuizConfig> {
  const [goals, skins] = await Promise.all([
    prisma.quizGoal.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { key: true, name: true, answer: true, related: true, bonusSkins: true },
    }),
    prisma.skinType.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { key: true, name: true, answer: true, alsoMatches: true, avoidMax: true },
    }),
  ]);
  return { goals, skins };
}
