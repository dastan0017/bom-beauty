import type { ProgramVariant, QuizAge, QuizExperience, QuizGoal, SkinType } from './enums';
import type { QuizConfig } from './schemas/quiz';

// Port of QUIZ, quizScore, quizRank and recTier in design/Bom Beauty Prototype.dc.html (design/updates-2026-10/README.md
// §2). Goals and skin types are the owner's lists (D47); the design's rules are settings of their items.

export interface QuizAnswers {
  goal: QuizGoal;
  skin: SkinType;
  exp: QuizExperience;
  age: QuizAge;
}

export type QuizKey = keyof QuizAnswers;

export interface QuizOption<V extends string> {
  value: V;
  label: string;
}

export interface QuizQuestion<K extends QuizKey = QuizKey> {
  key: K;
  title: string;
  options: QuizOption<QuizAnswers[K]>[];
}

export const QUIZ_KEYS: readonly QuizKey[] = ['goal', 'skin', 'exp', 'age'];

/**
 * The quiz as the design has it (QUIZ, Q_REL, skinHit, the sensitive bonus, recTier). The seed and the migration start
 * from it; afterwards the owner edits goals and skin types in «Подбор в тесте».
 */
export const DEFAULT_QUIZ: QuizConfig = {
  goals: [
    {
      key: 'acne',
      name: 'Высыпания, чёрные точки, комедоны',
      answer: 'Избавиться от высыпаний, чёрных точек и закрытых комедонов',
      related: ['pigment'],
      bonusSkins: [],
    },
    {
      key: 'pigment',
      name: 'Пигментация, постакне, неровный тон',
      answer: 'Уменьшить пигментацию, постакне и выровнять тон',
      related: ['acne', 'glow'],
      bonusSkins: [],
    },
    {
      key: 'age',
      name: 'Упругость, морщины, овал лица',
      answer: 'Повысить упругость, разгладить морщины и подтянуть овал',
      related: ['glow', 'pigment'],
      bonusSkins: [],
    },
    {
      key: 'calm',
      name: 'Краснота, шелушения, чувствительность',
      answer: 'Снять красноту, шелушения, зуд и чувствительность',
      related: ['glow'],
      bonusSkins: ['sens'],
    },
    {
      key: 'glow',
      name: 'Тусклая кожа: сияние и увлажнение',
      answer: 'Вернуть сияние «уставшей» и тусклой коже, глубоко увлажнить',
      related: ['calm', 'age'],
      bonusSkins: [],
    },
  ],
  skins: [
    {
      key: 'oily',
      name: 'Жирная',
      answer: 'Появляется сильный жирный блеск по всему лицу',
      alsoMatches: [],
      avoidMax: false,
    },
    {
      key: 'combo',
      name: 'Комбинированная',
      answer: 'Блестит только Т-зона (лоб, нос, подбородок), а на щеках комфортно',
      alsoMatches: ['oily'],
      avoidMax: false,
    },
    {
      key: 'dry',
      name: 'Сухая',
      answer: 'Чувствуется стянутость, хочется скорее нанести крем',
      alsoMatches: [],
      avoidMax: false,
    },
    {
      key: 'sens',
      name: 'Чувствительная',
      answer: 'Кожа краснеет, реагирует на воду или смену температуры',
      alsoMatches: [],
      avoidMax: true,
    },
    {
      key: 'normal',
      name: 'Нормальная',
      answer: 'Всё в порядке, нет явного дискомфорта',
      alsoMatches: [],
      avoidMax: false,
    },
  ],
};

const EXPERIENCE: QuizQuestion<'exp'> = {
  key: 'exp',
  title: 'Использовали ли вы ранее активную профессиональную косметику (кислоты, ретинол, пептиды)?',
  options: [
    { value: 'pro', label: 'Да, регулярно пользуюсь активным уходом, кожа привыкла' },
    { value: 'some', label: 'Пробовала отдельные средства, но нет чёткой системы' },
    { value: 'new', label: 'Почти не пользовалась / Кожа очень чувствительная, легко раздражается' },
  ],
};

const AGE: QuizQuestion<'age'> = {
  key: 'age',
  title: 'Укажите ваш возраст',
  options: [
    { value: 'u25', label: 'До 25 лет' },
    { value: '25', label: '25–35 лет' },
    { value: '35', label: '35–45 лет' },
    { value: '45', label: '45+ лет' },
  ],
};

/** The four questions; the answers to the first two are the owner's goals and skin types. */
export function quizQuestions(
  config: QuizConfig,
): [QuizQuestion<'goal'>, QuizQuestion<'skin'>, QuizQuestion<'exp'>, QuizQuestion<'age'>] {
  return [
    {
      key: 'goal',
      title: 'Какую главную задачу вы хотите решить в первую очередь?',
      options: config.goals.map((goal) => ({ value: goal.key, label: goal.answer })),
    },
    {
      key: 'skin',
      title: 'Как ведёт себя ваша кожа спустя 2–3 часа после умывания?',
      options: config.skins.map((skin) => ({ value: skin.key, label: skin.answer })),
    },
    EXPERIENCE,
    AGE,
  ];
}

/** Label of the chosen option, or "—" when unanswered or no longer in the lists. */
export function quizAnswerLabel<K extends QuizKey>(
  key: K,
  value: QuizAnswers[K] | undefined,
  config: QuizConfig,
): string {
  const question = quizQuestions(config).find((q) => q.key === key);
  const option = question?.options.find((o) => o.value === value);
  return option?.label ?? '—';
}

export interface QuizRankable {
  quizGoal: QuizGoal | null;
  quizSkins: readonly SkinType[];
}

/** The program's skin list includes the answer, or a skin type the answer also matches (combo → oily). */
function skinMatches(skins: readonly SkinType[], skin: SkinType | undefined, config: QuizConfig): boolean {
  if (skin === undefined) return false;
  const also = config.skins.find((item) => item.key === skin)?.alsoMatches ?? [];
  return skins.includes(skin) || also.some((key) => skins.includes(key));
}

/** Answers to "exp" and "age" go to Нурайым in WhatsApp; only the goal and the skin rank programs. */
export function quizScore(program: QuizRankable, answers: Partial<QuizAnswers>, config: QuizConfig): number {
  const skins = program.quizSkins;
  const related = config.goals.find((goal) => goal.key === answers.goal)?.related ?? [];
  const goal = config.goals.find((item) => item.key === program.quizGoal);
  let score =
    program.quizGoal === answers.goal ? 10 : program.quizGoal && related.includes(program.quizGoal) ? 4 : 0;
  score += skins.length ? (skinMatches(skins, answers.skin, config) ? 3 : 0) : 2;
  if (answers.skin !== undefined && goal?.bonusSkins.includes(answers.skin)) score += 3;
  return score;
}

/** Up to 3 programs, best first (ties keep the admin order); the first 3 when nothing scores 5 or more. */
export function rankPrograms<T extends QuizRankable>(
  programs: readonly T[],
  answers: Partial<QuizAnswers>,
  config: QuizConfig,
): T[] {
  const ranked = programs
    .map((program, index) => ({ program, index, score: quizScore(program, answers, config) }))
    .filter((entry) => entry.program.quizGoal !== null && entry.score >= 5)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((entry) => entry.program);
  return ranked.length ? ranked : programs.slice(0, 3);
}

/**
 * Variant the quiz suggests for programs that have several (design: recTier): «Мини» for a beginner, «Максимум» for a
 * regular user of actives or anyone from 35, but never «Максимум» for a skin type marked so (sensitive skin);
 * «Стандарт» otherwise.
 */
export function recommendVariant(answers: Partial<QuizAnswers>, config: QuizConfig): ProgramVariant {
  const level: ProgramVariant =
    answers.exp === 'new'
      ? 'mini'
      : answers.exp === 'pro' || answers.age === '35' || answers.age === '45'
        ? 'max'
        : 'standard';
  const gentle = config.skins.find((skin) => skin.key === answers.skin)?.avoidMax ?? false;
  return level === 'max' && gentle ? 'standard' : level;
}

/** Answer labels of the quiz before October 2026 (skin, goal, experience, format), for leads saved back then. */
const LEGACY_ANSWER_LABELS: Record<string, Record<string, string>> = {
  skin: {
    dry: 'Сухая / обезвоженная',
    oily: 'Комбинированная / жирная',
    normal: 'Нормальная',
    sens: 'Чувствительная / склонная к куперозу',
  },
  goal: {
    age: 'Возрастные изменения / лифтинг',
    pigment: 'Пигментация / тусклый цвет',
    acne: 'Высыпания / акне',
    barrier: 'Восстановление и глубокое увлажнение',
  },
  exp: {
    pro: 'Да, постоянно',
    mass: 'Нет, в основном масс-маркет или аптечные марки',
    new: 'Только начинаю знакомство с корейским уходом',
  },
  fmt: { set: 'Готовый набор средств', wa: 'Персональная консультация в WhatsApp' },
};

/**
 * The answers of a stored quiz lead as labels, whichever quiz version it came from. A goal or skin type the owner has
 * deleted since is left out (the lead's message keeps the full text).
 */
export function quizLeadAnswers(answers: Record<string, string>, config: QuizConfig): string[] {
  if ('fmt' in answers) {
    return ['skin', 'goal', 'exp', 'fmt'].flatMap((key) => {
      const value = answers[key];
      const label = value ? LEGACY_ANSWER_LABELS[key]?.[value] : undefined;
      return label ? [label] : [];
    });
  }
  return QUIZ_KEYS.flatMap((key) => {
    const label = quizAnswerLabel(key, answers[key] as never, config);
    return label === '—' ? [] : [label];
  });
}
