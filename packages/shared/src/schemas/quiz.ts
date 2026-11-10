import { z } from '../zod';

// The quiz's goals (question 1) and skin types (question 2), edited by the owner in «Подбор в тесте» (D47). A key
// never changes once created: programs, leads and the rules below refer to items by it.

export const quizKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'quiz.key.invalid');

export const quizGoalSchema = z.object({
  key: quizKeySchema,
  /** Short name for the admin ("Высыпания, чёрные точки, комедоны"). */
  name: z.string(),
  /** The answer as the site's quiz shows it. */
  answer: z.string(),
  /** Goals whose programs also fit, ranked lower (design: Q_REL). */
  related: z.array(z.string()),
  /** Skin types that raise programs with this goal (design: sensitive skin and calming programs). */
  bonusSkins: z.array(z.string()),
});
export type QuizGoalItem = z.infer<typeof quizGoalSchema>;

export const skinTypeSchema = z.object({
  key: quizKeySchema,
  name: z.string(),
  answer: z.string(),
  /** Programs tagged for these skin types also fit (design: combination skin also matches oily). */
  alsoMatches: z.array(z.string()),
  /** The quiz never suggests «Максимум» for this skin (design: recTier and sensitive skin). */
  avoidMax: z.boolean(),
});
export type SkinTypeItem = z.infer<typeof skinTypeSchema>;

/** GET /catalog/quiz: both lists in the owner's order. */
export const quizConfigSchema = z.object({
  goals: z.array(quizGoalSchema),
  skins: z.array(skinTypeSchema),
});
export type QuizConfig = z.infer<typeof quizConfigSchema>;

/** GET /admin/quiz: the lists with how many programs use each item (the delete warning). */
export const adminQuizSchema = z.object({
  goals: z.array(quizGoalSchema.extend({ programCount: z.number().int() })),
  skins: z.array(skinTypeSchema.extend({ programCount: z.number().int() })),
});
export type AdminQuiz = z.infer<typeof adminQuizSchema>;

export const QUIZ_ITEMS_MAX = 12;

const nameInput = z.string().trim().min(1, 'quiz.name.required').max(60, 'text.too_long');
const answerInput = z.string().trim().min(1, 'quiz.answer.required').max(160, 'text.too_long');
const keyList = z.array(quizKeySchema).max(QUIZ_ITEMS_MAX);

/**
 * PUT /admin/quiz: both whole lists in order. Items are matched by key: a new key adds an item (the admin makes one
 * up), a missing key deletes it. Rules may only name items of the same save.
 */
export const quizInputSchema = z
  .object({
    goals: z
      .array(
        z.object({
          key: quizKeySchema,
          name: nameInput,
          answer: answerInput,
          related: keyList,
          bonusSkins: keyList,
        }),
      )
      .min(1, 'quiz.goals.required')
      .max(QUIZ_ITEMS_MAX, 'quiz.items.max'),
    skins: z
      .array(
        z.object({
          key: quizKeySchema,
          name: nameInput,
          answer: answerInput,
          alsoMatches: keyList,
          avoidMax: z.boolean(),
        }),
      )
      .min(1, 'quiz.skins.required')
      .max(QUIZ_ITEMS_MAX, 'quiz.items.max'),
  })
  .superRefine((value, ctx) => {
    const goals = new Set(value.goals.map((goal) => goal.key));
    const skins = new Set(value.skins.map((skin) => skin.key));
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (goals.size !== value.goals.length) issue(['goals'], 'quiz.key.duplicate');
    if (skins.size !== value.skins.length) issue(['skins'], 'quiz.key.duplicate');
    value.goals.forEach((goal, index) => {
      if (goal.related.some((key) => key === goal.key || !goals.has(key)))
        issue(['goals', index, 'related'], 'quiz.rule.unknown');
      if (goal.bonusSkins.some((key) => !skins.has(key)))
        issue(['goals', index, 'bonusSkins'], 'quiz.rule.unknown');
    });
    value.skins.forEach((skin, index) => {
      if (skin.alsoMatches.some((key) => key === skin.key || !skins.has(key)))
        issue(['skins', index, 'alsoMatches'], 'quiz.rule.unknown');
    });
  });
export type QuizInput = z.output<typeof quizInputSchema>;
