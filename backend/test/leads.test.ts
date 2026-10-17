import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, request, type TestContext } from './app';

const meta = () => ({ clientRef: randomUUID(), message: 'm', pageUrl: 'http://localhost:3100/' });

describe('POST /v1/leads/*', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('stores the quiz answers with the server ranking', async () => {
    const res = await request<{ id: string }>(ctx.url('/v1/leads/quiz'), {
      method: 'POST',
      json: { ...meta(), answers: { skin: 'sens', goal: 'pigment', exp: 'pro', fmt: 'wa' }, choose: true },
    });
    expect(res.status).toBe(201);
    const row = await ctx.prisma.lead.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row).toMatchObject({
      kind: 'quiz',
      choose: true,
      recommended: ['pigmentation', 'sensitive-skin'],
    });
  });

  it('ranks only published programs', async () => {
    await ctx.prisma.program.update({ where: { slug: 'pigmentation' }, data: { published: false } });
    const res = await request<{ id: string }>(ctx.url('/v1/leads/quiz'), {
      method: 'POST',
      json: { ...meta(), answers: { skin: 'sens', goal: 'pigment', exp: 'pro', fmt: 'set' } },
    });
    const row = await ctx.prisma.lead.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.recommended).toEqual(['sensitive-skin']);
    await ctx.prisma.program.update({ where: { slug: 'pigmentation' }, data: { published: true } });
  });

  it('stores a wholesale request and is idempotent', async () => {
    const body = { ...meta(), answers: { buyer: 'salon', country: 'kz' } };
    const first = await request<{ id: string }>(ctx.url('/v1/leads/wholesale'), {
      method: 'POST',
      json: body,
    });
    const second = await request<{ id: string }>(ctx.url('/v1/leads/wholesale'), {
      method: 'POST',
      json: body,
    });
    expect(first.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(await ctx.prisma.lead.count({ where: { kind: 'wholesale' } })).toBe(1);
  });

  it('validates answers', async () => {
    const res = await request(ctx.url('/v1/leads/quiz'), {
      method: 'POST',
      json: { ...meta(), answers: { skin: 'oily', goal: 'nope', exp: 'pro', fmt: 'set' } },
    });
    expect(res.status).toBe(400);
  });
});
