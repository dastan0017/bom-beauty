import { describe, expect, it } from 'vitest';
import { QUIZ_GOALS, SKIN_TYPES, type QuizGoal, type SkinType } from './enums';
import { QUIZ_QUESTIONS, quizAnswerLabel, quizLeadAnswers, rankPrograms, type QuizRankable } from './quiz';

// The eight programs of design/Bom Beauty Prototype.dc.html (PROGRAMS), in the admin order (P_ORDER).
const programs: (QuizRankable & { slug: string })[] = [
  { slug: 'acne', quizGoal: 'acne', quizSkins: ['combo', 'normal', 'dry'] },
  { slug: 'pores', quizGoal: 'acne', quizSkins: ['oily', 'combo'] },
  { slug: 'pigment', quizGoal: 'pigment', quizSkins: ['dry', 'oily', 'combo', 'normal'] },
  { slug: 'lifting', quizGoal: 'age', quizSkins: ['dry', 'normal', 'combo'] },
  { slug: 'glow', quizGoal: 'glow', quizSkins: ['oily', 'combo', 'normal'] },
  { slug: 'dry', quizGoal: 'glow', quizSkins: ['dry', 'normal'] },
  { slug: 'sensitive', quizGoal: 'calm', quizSkins: ['sens'] },
  { slug: 'recovery', quizGoal: 'calm', quizSkins: ['dry', 'normal', 'sens'] },
];

/** The design's quizScore / quizRank, transcribed from the prototype as the reference. */
const Q_REL: Record<string, string[]> = {
  acne: ['pigment'],
  pigment: ['acne', 'glow'],
  age: ['glow', 'pigment'],
  calm: ['glow'],
  glow: ['calm', 'age'],
};
const skinHit = (sk: readonly string[], a: string) =>
  sk.includes(a) || (a === 'combo' && sk.includes('oily'));
function designScore(p: QuizRankable, a: { goal: string; skin: string }): number {
  const sk = p.quizSkins;
  let n = p.quizGoal === a.goal ? 10 : (Q_REL[a.goal] ?? []).includes(p.quizGoal ?? '') ? 4 : 0;
  n += sk.length ? (skinHit(sk, a.skin) ? 3 : 0) : 2;
  if (a.skin === 'sens' && p.quizGoal === 'calm') n += 3;
  return n;
}
function designRank(a: { goal: string; skin: string }): string[] {
  const r = programs
    .map((p, i) => ({ p, i, n: designScore(p, a) }))
    .filter((x) => x.p.quizGoal && x.n >= 5)
    .sort((x, y) => y.n - x.n || x.i - y.i)
    .slice(0, 3)
    .map((x) => x.p.slug);
  return r.length ? r : programs.slice(0, 3).map((p) => p.slug);
}

const rank = (goal: QuizGoal, skin: SkinType) =>
  rankPrograms(programs, { goal, skin, exp: 'some', age: '25' }).map((p) => p.slug);

describe('rankPrograms (parity with the design scoring)', () => {
  it.each(QUIZ_GOALS.flatMap((goal) => SKIN_TYPES.map((skin) => [goal, skin] as const)))(
    '%s + %s matches the prototype',
    (goal, skin) => expect(rank(goal, skin)).toEqual(designRank({ goal, skin })),
  );

  it('combo skin also matches programs for oily skin', () => {
    expect(rank('acne', 'combo')).toEqual(['acne', 'pores', 'pigment']);
  });

  it('sensitive skin adds a bonus to calming programs', () => {
    expect(rank('calm', 'sens')).toEqual(['sensitive', 'recovery']);
    // Tied at 10: the glow programs by goal, the calming ones by relation + skin + bonus; admin order wins.
    expect(rank('glow', 'sens')).toEqual(['glow', 'dry', 'sensitive']);
  });

  it('ignores experience and age', () => {
    const a = rankPrograms(programs, { goal: 'age', skin: 'dry', exp: 'pro', age: '45' });
    const b = rankPrograms(programs, { goal: 'age', skin: 'dry', exp: 'new', age: 'u25' });
    expect(a).toEqual(b);
  });

  it('skips programs that are not in the quiz and falls back to the first three', () => {
    const list = [{ slug: 'x', quizGoal: null, quizSkins: [] }, ...programs];
    expect(rankPrograms(list, { goal: 'acne', skin: 'oily' }).map((p) => p.slug)).toEqual([
      'pores',
      'acne',
      'pigment',
    ]);
    const unmatched = [{ slug: 'a', quizGoal: 'age' as const, quizSkins: ['dry' as const] }];
    expect(rankPrograms(unmatched, { goal: 'acne', skin: 'oily' }).map((p) => p.slug)).toEqual(['a']);
  });
});

describe('questions', () => {
  it('ask goal, skin, experience and age in that order', () => {
    expect(QUIZ_QUESTIONS.map((q) => q.key)).toEqual(['goal', 'skin', 'exp', 'age']);
  });

  it('labels answers verbatim', () => {
    expect(quizAnswerLabel('age', '35')).toBe('35–45 лет');
    expect(quizAnswerLabel('skin', undefined)).toBe('—');
  });
});

describe('quizLeadAnswers', () => {
  it('labels new and pre-October-2026 leads', () => {
    expect(quizLeadAnswers({ goal: 'calm', skin: 'sens', exp: 'new', age: '45' })).toEqual([
      'Снять красноту, шелушения, зуд и чувствительность',
      'Кожа краснеет, реагирует на воду или смену температуры',
      'Почти не пользовалась / Кожа очень чувствительная, легко раздражается',
      '45+ лет',
    ]);
    expect(quizLeadAnswers({ skin: 'oily', goal: 'barrier', exp: 'mass', fmt: 'wa' })).toEqual([
      'Комбинированная / жирная',
      'Восстановление и глубокое увлажнение',
      'Нет, в основном масс-маркет или аптечные марки',
      'Персональная консультация в WhatsApp',
    ]);
  });
});
