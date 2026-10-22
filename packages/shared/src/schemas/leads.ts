import { z } from '../zod';
import {
  QUIZ_AGES,
  QUIZ_EXPERIENCES,
  QUIZ_GOALS,
  SKIN_TYPES,
  WHOLESALE_BUYERS,
  WHOLESALE_COUNTRIES,
} from '../enums';
import { submissionMetaShape } from './common';

export const quizAnswersSchema = z.object({
  goal: z.enum(QUIZ_GOALS),
  skin: z.enum(SKIN_TYPES),
  exp: z.enum(QUIZ_EXPERIENCES),
  age: z.enum(QUIZ_AGES),
});

export const wholesaleAnswersSchema = z.object({
  buyer: z.enum(WHOLESALE_BUYERS).optional(),
  country: z.enum(WHOLESALE_COUNTRIES).optional(),
});

/** POST /leads/quiz: the quiz result handed to WhatsApp. */
export const createQuizLeadSchema = z.object({
  ...submissionMetaShape,
  answers: quizAnswersSchema,
  /**
   * true: "Спросить Нурайым в WhatsApp" (help choosing). The October 2026 quiz has only this hand-off;
   * false marks leads from the earlier "Получить разбор в WhatsApp" button.
   */
  choose: z.boolean().default(true),
});
export type CreateQuizLeadInput = z.input<typeof createQuizLeadSchema>;
export type CreateQuizLead = z.output<typeof createQuizLeadSchema>;

/** POST /leads/wholesale: the price request handed to WhatsApp. */
export const createWholesaleLeadSchema = z.object({
  ...submissionMetaShape,
  answers: wholesaleAnswersSchema,
});
export type CreateWholesaleLeadInput = z.input<typeof createWholesaleLeadSchema>;
export type CreateWholesaleLead = z.output<typeof createWholesaleLeadSchema>;

export const createLeadResponseSchema = z.object({ id: z.uuid() });
export type CreateLeadResponse = z.infer<typeof createLeadResponseSchema>;
