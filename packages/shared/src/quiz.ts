import type { QuizExperience, QuizFormat, QuizGoal, SkinType } from './enums';

// Port of QUIZ, quizScore, quizRank and qForText in design/Bom Beauty Prototype.dc.html.

export interface QuizAnswers {
  skin: SkinType;
  goal: QuizGoal;
  exp: QuizExperience;
  fmt: QuizFormat;
}

export type QuizKey = keyof QuizAnswers;

export interface QuizOption<V extends string> {
  value: V;
  label: string;
  hint: string;
}

export interface QuizQuestion<K extends QuizKey = QuizKey> {
  key: K;
  title: string;
  options: QuizOption<QuizAnswers[K]>[];
}

export const QUIZ_QUESTIONS: [
  QuizQuestion<'skin'>,
  QuizQuestion<'goal'>,
  QuizQuestion<'exp'>,
  QuizQuestion<'fmt'>,
] = [
  {
    key: 'skin',
    title: 'Какой у вас тип кожи или её текущее состояние?',
    options: [
      { value: 'dry', label: 'Сухая / обезвоженная', hint: 'Есть чувство стянутости, шелушения' },
      { value: 'oily', label: 'Комбинированная / жирная', hint: 'Блеск в Т-зоне, расширенные поры' },
      { value: 'normal', label: 'Нормальная', hint: 'Особых проблем нет, нужен качественный базовый уход' },
      {
        value: 'sens',
        label: 'Чувствительная / склонная к куперозу',
        hint: 'Краснеет от косметики или перепадов температуры',
      },
    ],
  },
  {
    key: 'goal',
    title: 'Какую главную задачу хотите решить прямо сейчас?',
    options: [
      {
        value: 'age',
        label: 'Возрастные изменения / лифтинг',
        hint: 'Морщинки, потеря упругости, «овал плывёт»',
      },
      {
        value: 'pigment',
        label: 'Пигментация / тусклый цвет',
        hint: 'Пятна, постакне, веснушки, хочется сияния',
      },
      {
        value: 'acne',
        label: 'Высыпания / акне',
        hint: 'Воспаления, комедоны, чёрные точки, расширенные поры',
      },
      {
        value: 'barrier',
        label: 'Восстановление и глубокое увлажнение',
        hint: 'Нарушен барьер, сухость, раздражения',
      },
    ],
  },
  {
    key: 'exp',
    title: 'Пользуетесь ли вы сейчас профессиональной косметикой?',
    options: [
      { value: 'pro', label: 'Да, постоянно', hint: 'Пептиды, PDRN, экзосомы или спикулы' },
      { value: 'mass', label: 'Нет, в основном масс-маркет или аптечные марки', hint: '' },
      { value: 'new', label: 'Только начинаю знакомство с корейским уходом', hint: '' },
    ],
  },
  {
    key: 'fmt',
    title: 'Какой формат подбора вам удобнее получить?',
    options: [
      { value: 'set', label: 'Готовый набор средств', hint: 'Подборка продуктов прямо на сайте' },
      {
        value: 'wa',
        label: 'Персональная консультация в WhatsApp',
        hint: 'Разбор текущего ухода и рекомендации',
      },
    ],
  },
];

/** Label of the chosen option, or "—" when unanswered. */
export function quizAnswerLabel<K extends QuizKey>(key: K, value: QuizAnswers[K] | undefined): string {
  const question = QUIZ_QUESTIONS.find((q) => q.key === key);
  const option = question?.options.find((o) => o.value === value);
  return option?.label ?? '—';
}

const SKIN_PHRASES: Record<SkinType, string> = {
  dry: 'сухая или обезвоженная кожа',
  oily: 'комбинированная или жирная кожа',
  normal: 'нормальная кожа',
  sens: 'чувствительная кожа',
};

const GOAL_PHRASES: Record<QuizGoal, string> = {
  age: 'лифтинг и упругость',
  pigment: 'ровный тон и сияние',
  acne: 'убрать высыпания',
  barrier: 'восстановление и увлажнение',
};

const RELATED_GOALS: Record<QuizGoal, QuizGoal[]> = {
  acne: ['pigment'],
  pigment: ['acne', 'age'],
  age: ['pigment', 'barrier'],
  barrier: ['age'],
};

export interface QuizRankable {
  quizGoal: QuizGoal | null;
  quizSkins: readonly SkinType[];
}

export function quizScore(program: QuizRankable, answers: Partial<QuizAnswers>): number {
  const skins = program.quizSkins;
  const related = answers.goal ? RELATED_GOALS[answers.goal] : [];
  let score =
    program.quizGoal === answers.goal ? 10 : program.quizGoal && related.includes(program.quizGoal) ? 4 : 0;
  score += skins.length ? (answers.skin && skins.includes(answers.skin) ? 3 : 0) : 2;
  if (answers.skin === 'sens' && skins.includes('sens')) {
    score += answers.goal === 'acne' || answers.goal === 'pigment' ? (answers.exp === 'pro' ? 5 : 8) : 2;
  }
  return score;
}

/** Up to 3 programs, best first; falls back to the first 3 when nothing scores 5 or more. */
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

/** "Чувствительная кожа · ровный тон и сияние" under "Подобрали для вас". */
export function quizResultCaption(answers: Partial<QuizAnswers>): string {
  const text = [answers.skin && SKIN_PHRASES[answers.skin], answers.goal && GOAL_PHRASES[answers.goal]]
    .filter(Boolean)
    .join(' · ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}
