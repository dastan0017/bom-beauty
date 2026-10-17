import { Inject, Injectable } from '@nestjs/common';
import {
  rankPrograms,
  type CreateLeadResponse,
  type CreateQuizLead,
  type CreateWholesaleLead,
} from '@bom/shared';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { hashIp } from '../common/client-ip';
import { fakeId, isBot, isDuplicateClientRef, utmJson } from '../common/submission';
import { TurnstileService } from '../common/turnstile.service';
import { PrismaService } from '../prisma/prisma.service';

type LeadInput = { kind: 'quiz'; data: CreateQuizLead } | { kind: 'wholesale'; data: CreateWholesaleLead };

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(input: LeadInput, meta: { ip: string }): Promise<CreateLeadResponse> {
    const { data } = input;
    if (isBot(data.website)) return { id: fakeId() };

    const existing = await this.findByClientRef(data.clientRef);
    if (existing) return existing;

    await this.turnstile.assertHuman(data.turnstileToken, meta.ip);

    // The site ranks locally for instant results; the record keeps the server's ranking over published programs.
    const recommended =
      input.kind === 'quiz'
        ? rankPrograms(
            await this.prisma.program.findMany({
              where: { published: true },
              orderBy: [{ order: 'asc' }, { title: 'asc' }],
              select: { slug: true, quizGoal: true, quizSkins: true },
            }),
            input.data.answers,
          ).map((program) => program.slug)
        : [];

    try {
      return await this.prisma.lead.create({
        data: {
          kind: input.kind,
          answers: data.answers,
          recommended,
          choose: input.kind === 'quiz' ? input.data.choose : false,
          message: data.message,
          pageUrl: data.pageUrl,
          referrer: data.referrer ?? null,
          utm: utmJson(data.utm),
          clientRef: data.clientRef,
          ipHash: hashIp(meta.ip, this.env.IP_HASH_SALT),
        },
        select: { id: true },
      });
    } catch (error) {
      if (isDuplicateClientRef(error)) {
        const winner = await this.findByClientRef(data.clientRef);
        if (winner) return winner;
      }
      throw error;
    }
  }

  private findByClientRef(clientRef: string): Promise<CreateLeadResponse | null> {
    return this.prisma.lead.findUnique({ where: { clientRef }, select: { id: true } });
  }
}
