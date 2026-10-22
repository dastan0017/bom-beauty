import type { QuizAge, QuizExperience, QuizGoal, SkinType } from './enums';

// Port of QUIZ, quizScore and quizRank in design/Bom Beauty Prototype.dc.html (design/updates-2026-10/README.md §2).

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

export const QUIZ_QUESTIONS: [
  QuizQuestion<'goal'>,
  QuizQuestion<'skin'>,
  QuizQuestion<'exp'>,
  QuizQuestion<'age'>,
] = [
  {
    key: 'goal',
    title: 'Какую главную задачу вы хотите решить в первую очередь?',
    options: [
      { value: 'acne', label: 'Избавиться от высыпаний, чёрных точек и закрытых комедонов' },
      { value: 'pigment', label: 'Уменьшить пигментацию, постакне и выровнять тон' },
      { value: 'age', label: 'Повысить упругость, разгладить морщины и подтянуть овал' },
      { value: 'calm', label: 'Снять красноту, шелушения, зуд и чувствительность' },
      { value: 'glow', label: 'Вернуть сияние «уставшей» и тусклой коже, глубоко увлажнить' },
    ],
  },
  {
    key: 'skin',
    title: 'Как ведёт себя ваша кожа спустя 2–3 часа после умывания?',
    options: [
      { value: 'oily', label: 'Появляется сильный жирный блеск по всему лицу' },
      { value: 'combo', label: 'Блестит только Т-зона (лоб, нос, подбородок), а на щеках комфортно' },
      { value: 'dry', label: 'Чувствуется стянутость, хочется скорее нанести крем' },
      { value: 'sens', label: 'Кожа краснеет, реагирует на воду или смену температуры' },
      { value: 'normal', label: 'Всё в порядке, нет явного дискомфорта' },
    ],
  },
  {
    key: 'exp',
    title: 'Использовали ли вы ранее активную профессиональную косметику (кислоты, ретинол, пептиды)?',
    options: [
      { value: 'pro', label: 'Да, регулярно пользуюсь активным уходом, кожа привыкла' },
      { value: 'some', label: 'Пробовала отдельные средства, но нет чёткой системы' },
      { value: 'new', label: 'Почти не пользовалась / Кожа очень чувствительная, легко раздражается' },
    ],
  },
  {
    key: 'age',
    title: 'Укажите ваш возраст',
    options: [
      { value: 'u25', label: 'До 25 лет' },
      { value: '25', label: '25–35 лет' },
      { value: '35', label: '35–45 лет' },
      { value: '45', label: '45+ лет' },
    ],
  },
];

/** Label of the chosen option, or "—" when unanswered. */
export function quizAnswerLabel<K extends QuizKey>(key: K, value: QuizAnswers[K] | undefined): string {
  const question = QUIZ_QUESTIONS.find((q) => q.key === key);
  const option = question?.options.find((o) => o.value === value);
  return option?.label ?? '—';
}

/** Goals that also fit a program, at a lower score (design: Q_REL). */
const RELATED_GOALS: Record<QuizGoal, QuizGoal[]> = {
  acne: ['pigment'],
  pigment: ['acne', 'glow'],
  age: ['glow', 'pigment'],
  calm: ['glow'],
  glow: ['calm', 'age'],
};

export interface QuizRankable {
  quizGoal: QuizGoal | null;
  quizSkins: readonly SkinType[];
}

/** A combo-skin answer also matches programs tagged for oily skin. */
const skinMatches = (skins: readonly SkinType[], skin: SkinType | undefined): boolean =>
  skin !== undefined && (skins.includes(skin) || (skin === 'combo' && skins.includes('oily')));

/** Answers to "exp" and "age" go to Нурайым in WhatsApp; only the goal and the skin rank programs. */
export function quizScore(program: QuizRankable, answers: Partial<QuizAnswers>): number {
  const skins = program.quizSkins;
  const related = answers.goal ? RELATED_GOALS[answers.goal] : [];
  let score =
    program.quizGoal === answers.goal ? 10 : program.quizGoal && related.includes(program.quizGoal) ? 4 : 0;
  score += skins.length ? (skinMatches(skins, answers.skin) ? 3 : 0) : 2;
  if (answers.skin === 'sens' && program.quizGoal === 'calm') score += 3;
  return score;
}

/** Up to 3 programs, best first (ties keep the admin order); the first 3 when nothing scores 5 or more. */
export function rankPrograms<T extends QuizRankable>(
  programs: readonly T[],
  answers: Partial<QuizAnswers>,
): T[] {
  const ranked = programs
    .map((program, index) => ({ program, index, score: quizScore(program, answers) }))
    .filter((entry) => entry.program.quizGoal !== null && entry.score >= 5)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((entry) => entry.program);
  return ranked.length ? ranked : programs.slice(0, 3);
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

/** The answers of a stored quiz lead as labels, whichever quiz version it came from. */
export function quizLeadAnswers(answers: Record<string, string>): string[] {
  if ('fmt' in answers) {
    return ['skin', 'goal', 'exp', 'fmt'].flatMap((key) => {
      const value = answers[key];
      const label = value ? LEGACY_ANSWER_LABELS[key]?.[value] : undefined;
      return label ? [label] : [];
    });
  }
  return QUIZ_QUESTIONS.flatMap((question) => {
    const label = quizAnswerLabel(question.key, answers[question.key] as never);
    return label === '—' ? [] : [label];
  });
}
