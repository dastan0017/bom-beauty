import { randomUUID } from 'node:crypto';
import { CONTENT_SCHEMAS, quizScore } from '@bom/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPOSITION,
  DELIVERY_CONTENT,
  HOME_CONTENT,
  HOME_RAILS,
  OFFER_CONTENT,
  PRIVACY_CONTENT,
  PRODUCTS,
  PROGRAMS,
  WHOLESALE_CONTENT,
  WHOLESALE_FEATURED,
} from '../src/seed/seed-data';

describe('seed data', () => {
  it('content blocks match their schemas', () => {
    expect(CONTENT_SCHEMAS.home.safeParse(HOME_CONTENT).success).toBe(true);
    expect(
      CONTENT_SCHEMAS.wholesale.safeParse({
        ...WHOLESALE_CONTENT,
        featuredProductIds: WHOLESALE_FEATURED.map(() => randomUUID()),
      }).success,
    ).toBe(true);
    expect(CONTENT_SCHEMAS.delivery.safeParse(DELIVERY_CONTENT).success).toBe(true);
    expect(CONTENT_SCHEMAS.privacy.safeParse(PRIVACY_CONTENT).success).toBe(true);
    expect(CONTENT_SCHEMAS.offer.safeParse(OFFER_CONTENT).success).toBe(true);
  });

  it('programs and their steps only reference catalog products', () => {
    const keys = new Set(PRODUCTS.map((p) => p.key));
    for (const program of PROGRAMS) {
      expect(program.items.every((key) => keys.has(key))).toBe(true);
      const steps = [...program.am, ...program.pm].map(([key]) => key);
      expect(steps.every((key) => keys.has(key))).toBe(true);
    }
  });

  it('has the eight programs of the design in the admin order', () => {
    expect(PROGRAMS.map((p) => p.slug)).toEqual([
      'acne',
      'pores',
      'pigmentation',
      'lifting',
      'glow',
      'dry-skin',
      'sensitive-skin',
      'recovery',
    ]);
  });

  it('home rails and compositions name real products', () => {
    const keys = new Set(PRODUCTS.map((p) => p.key));
    for (const list of Object.values(HOME_RAILS)) expect(list.every((key) => keys.has(key))).toBe(true);
    expect(Object.keys(COMPOSITION).sort()).toEqual([...keys].sort());
  });

  it('every program can appear in quiz results', () => {
    for (const program of PROGRAMS) {
      expect(
        quizScore(program, { goal: program.quizGoal, skin: program.quizSkins[0] }),
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it('copy we wrote ourselves has no em-dashes', () => {
    const ours = JSON.stringify([DELIVERY_CONTENT, PRIVACY_CONTENT, OFFER_CONTENT]);
    expect(ours).not.toContain('—');
  });
});
