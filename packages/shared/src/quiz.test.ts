import { describe, expect, it } from 'vitest';
import type { QuizGoal, SkinType } from './enums';
import { quizResultCaption, rankPrograms, type QuizRankable } from './quiz';

// The five programs from design/Bom Beauty Prototype.dc.html (PROGRAMS), in order.
const programs: (QuizRankable & { slug: string })[] = [
  { slug: 'acne', quizGoal: 'acne', quizSkins: ['oily', 'normal'] },
  { slug: 'dry', quizGoal: 'barrier', quizSkins: ['dry', 'normal'] },
  { slug: 'pigment', quizGoal: 'pigment', quizSkins: ['dry', 'oily', 'normal'] },
  { slug: 'sensitive', quizGoal: 'barrier', quizSkins: ['sens'] },
  { slug: 'lifting', quizGoal: 'age', quizSkins: ['dry', 'normal'] },
];

const rank = (skin: SkinType, goal: QuizGoal | undefined, exp?: 'pro' | 'mass' | 'new') =>
  rankPrograms(programs, { skin, ...(goal ? { goal } : {}), ...(exp ? { exp } : {}) }).map((p) => p.slug);

describe('rankPrograms (parity with the design scoring)', () => {
  it('oily skin + acne', () => expect(rank('oily', 'acne', 'new')).toEqual(['acne', 'pigment']));
  it('sensitive skin + pigment, pro', () =>
    expect(rank('sens', 'pigment', 'pro')).toEqual(['pigment', 'sensitive']));
  it('dry skin + age keeps catalog order on ties', () =>
    expect(rank('dry', 'age')).toEqual(['lifting', 'dry', 'pigment']));
  it('falls back to the first three when nothing scores', () =>
    expect(rank('normal', undefined)).toEqual(['acne', 'dry', 'pigment']));
  it('skips programs that are not in the quiz', () => {
    const list = [{ slug: 'x', quizGoal: null, quizSkins: [] }, ...programs];
    expect(rankPrograms(list, { skin: 'oily', goal: 'acne' }).map((p) => p.slug)).toEqual([
      'acne',
      'pigment',
    ]);
  });
});

describe('quizResultCaption', () => {
  it('capitalises the first phrase', () => {
    expect(quizResultCaption({ skin: 'sens', goal: 'pigment' })).toBe(
      'Чувствительная кожа · ровный тон и сияние',
    );
  });
});
