import { describe, expect, it } from 'vitest';
import type { QuizGoal, SkinType } from './enums';
import {
  DEFAULT_QUIZ,
  quizAnswerLabel,
  quizLeadAnswers,
  quizQuestions,
  rankPrograms,
  recommendVariant,
  type QuizRankable,
} from './quiz';
import { quizInputSchema, type QuizConfig } from './schemas/quiz';

const QUIZ_GOALS = DEFAULT_QUIZ.goals.map((goal) => goal.key);
const SKIN_TYPES = DEFAULT_QUIZ.skins.map((skin) => skin.key);

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
  rankPrograms(programs, { goal, skin, exp: 'some', age: '25' }, DEFAULT_QUIZ).map((p) => p.slug);

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
    const a = rankPrograms(programs, { goal: 'age', skin: 'dry', exp: 'pro', age: '45' }, DEFAULT_QUIZ);
    const b = rankPrograms(programs, { goal: 'age', skin: 'dry', exp: 'new', age: 'u25' }, DEFAULT_QUIZ);
    expect(a).toEqual(b);
  });

  it('skips programs that are not in the quiz and falls back to the first three', () => {
    const list = [{ slug: 'x', quizGoal: null, quizSkins: [] }, ...programs];
    expect(rankPrograms(list, { goal: 'acne', skin: 'oily' }, DEFAULT_QUIZ).map((p) => p.slug)).toEqual([
      'pores',
      'acne',
      'pigment',
    ]);
    const unmatched = [{ slug: 'a', quizGoal: 'age', quizSkins: ['dry'] }];
    expect(rankPrograms(unmatched, { goal: 'acne', skin: 'oily' }, DEFAULT_QUIZ).map((p) => p.slug)).toEqual([
      'a',
    ]);
  });
});

describe('questions', () => {
  it('ask goal, skin, experience and age in that order', () => {
    expect(quizQuestions(DEFAULT_QUIZ).map((q) => q.key)).toEqual(['goal', 'skin', 'exp', 'age']);
  });

  it('labels answers verbatim', () => {
    expect(quizAnswerLabel('age', '35', DEFAULT_QUIZ)).toBe('35–45 лет');
    expect(quizAnswerLabel('skin', undefined, DEFAULT_QUIZ)).toBe('—');
  });

  it("asks the owner's goals and skin types in her order, with her answer texts", () => {
    const [goal, skin] = quizQuestions(DEFAULT_QUIZ);
    expect(goal.options.map((o) => o.value)).toEqual(['acne', 'pigment', 'age', 'calm', 'glow']);
    expect(skin.options[1]?.label).toBe('Блестит только Т-зона (лоб, нос, подбородок), а на щеках комфортно');
  });
});

describe('quizLeadAnswers', () => {
  it('labels new and pre-October-2026 leads', () => {
    expect(quizLeadAnswers({ goal: 'calm', skin: 'sens', exp: 'new', age: '45' }, DEFAULT_QUIZ)).toEqual([
      'Снять красноту, шелушения, зуд и чувствительность',
      'Кожа краснеет, реагирует на воду или смену температуры',
      'Почти не пользовалась / Кожа очень чувствительная, легко раздражается',
      '45+ лет',
    ]);
    expect(quizLeadAnswers({ skin: 'oily', goal: 'barrier', exp: 'mass', fmt: 'wa' }, DEFAULT_QUIZ)).toEqual([
      'Комбинированная / жирная',
      'Восстановление и глубокое увлажнение',
      'Нет, в основном масс-маркет или аптечные марки',
      'Персональная консультация в WhatsApp',
    ]);
  });
});

/** The owner's edits: a new goal related to «Акне», a renamed skin type, a skin type deleted. */
function edited(): QuizConfig {
  return {
    goals: [
      ...DEFAULT_QUIZ.goals.map((goal) =>
        goal.key === 'acne' ? { ...goal, related: [...goal.related, 'pores-x'] } : goal,
      ),
      { key: 'pores-x', name: 'Поры', answer: 'Сузить поры', related: ['acne'], bonusSkins: ['oily'] },
    ],
    skins: DEFAULT_QUIZ.skins
      .filter((skin) => skin.key !== 'normal')
      .map((skin) => (skin.key === 'dry' ? { ...skin, answer: 'Кожа сухая' } : skin)),
  };
}

describe("the owner's lists drive the quiz (D47)", () => {
  const list = [
    { slug: 'acne', quizGoal: 'acne', quizSkins: ['combo'] },
    { slug: 'pores', quizGoal: 'pores-x', quizSkins: ['oily'] },
    { slug: 'glow', quizGoal: 'glow', quizSkins: [] },
  ];

  it('asks the new goal and leaves the deleted skin type out', () => {
    const [goal, skin] = quizQuestions(edited());
    expect(goal.options.at(-1)).toEqual({ value: 'pores-x', label: 'Сузить поры' });
    expect(skin.options.map((o) => o.value)).not.toContain('normal');
    expect(quizAnswerLabel('skin', 'dry', edited())).toBe('Кожа сухая');
  });

  it('ranks with the new goal, its related goals and its skin bonus', () => {
    // pores: own goal 10 + oily skin 3 + bonus 3. acne: related 4 + combo is not oily, 4 < 5 so it drops out.
    expect(rankPrograms(list, { goal: 'pores-x', skin: 'oily' }, edited()).map((p) => p.slug)).toEqual([
      'pores',
    ]);
    // acne: 10 + 3. pores: related 4 + combo also matches oily 3 = 7. glow: any skin 2, out.
    expect(rankPrograms(list, { goal: 'acne', skin: 'combo' }, edited()).map((p) => p.slug)).toEqual([
      'acne',
      'pores',
    ]);
  });

  it('keeps «Максимум» away from a skin type marked so', () => {
    const answers = { goal: 'acne', exp: 'pro' as const, age: '25' as const };
    expect(recommendVariant({ ...answers, skin: 'sens' }, DEFAULT_QUIZ)).toBe('standard');
    expect(recommendVariant({ ...answers, skin: 'oily' }, DEFAULT_QUIZ)).toBe('max');
    const calm = {
      ...DEFAULT_QUIZ,
      skins: DEFAULT_QUIZ.skins.map((s) => ({ ...s, avoidMax: s.key === 'oily' })),
    };
    expect(recommendVariant({ ...answers, skin: 'oily' }, calm)).toBe('standard');
  });

  it('skips a deleted answer when labelling a stored lead', () => {
    expect(quizLeadAnswers({ goal: 'acne', skin: 'normal', exp: 'some', age: '25' }, edited())).toEqual([
      'Избавиться от высыпаний, чёрных точек и закрытых комедонов',
      'Пробовала отдельные средства, но нет чёткой системы',
      '25–35 лет',
    ]);
  });
});

describe('quizInputSchema', () => {
  const input = (config: QuizConfig) => ({
    goals: config.goals,
    skins: config.skins,
  });
  const codes = (value: unknown) => {
    const parsed = quizInputSchema.safeParse(value);
    return parsed.success
      ? {}
      : Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
  };

  it('accepts the design defaults', () => {
    expect(codes(input(DEFAULT_QUIZ))).toEqual({});
  });

  it('refuses rules that name items outside the save, duplicates and empty lists', () => {
    const base = edited();
    const broken = {
      goals: base.goals.map((goal, i) => (i === 0 ? { ...goal, related: ['acne', 'nope'] } : goal)),
      // «Нормальная» is deleted in this save.
      skins: base.skins.map((skin, i) => (i === 0 ? { ...skin, alsoMatches: ['normal'] } : skin)),
    };
    expect(codes(input(broken))).toEqual({
      'goals.0.related': 'quiz.rule.unknown',
      'skins.0.alsoMatches': 'quiz.rule.unknown',
    });
    expect(
      codes({ goals: [...DEFAULT_QUIZ.goals, DEFAULT_QUIZ.goals[0]], skins: DEFAULT_QUIZ.skins }),
    ).toEqual({
      goals: 'quiz.key.duplicate',
    });
    expect(codes({ goals: [], skins: DEFAULT_QUIZ.skins })).toEqual({ goals: 'quiz.goals.required' });
    expect(codes({ ...input(DEFAULT_QUIZ), goals: [{ ...DEFAULT_QUIZ.goals[0], name: ' ' }] })).toMatchObject(
      {
        'goals.0.name': 'quiz.name.required',
      },
    );
  });
});
