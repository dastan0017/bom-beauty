import { z } from '../zod';
import {
  QUIZ_EXPERIENCES,
  QUIZ_FORMATS,
  QUIZ_GOALS,
  SKIN_TYPES,
  WHOLESALE_BUYERS,
  WHOLESALE_COUNTRIES,
} from '../enums';
import { submissionMetaShape } from './common';

export const quizAnswersSchema = z.object({
  skin: z.enum(SKIN_TYPES),
  goal: z.enum(QUIZ_GOALS),
  exp: z.enum(QUIZ_EXPERIENCES),
  fmt: z.enum(QUIZ_FORMATS),
});

export const wholesaleAnswersSchema = z.object({
  buyer: z.enum(WHOLESALE_BUYERS).optional(),
  country: z.enum(WHOLESALE_COUNTRIES).optional(),
});

/** POST /leads/quiz: the quiz result handed to WhatsApp. */
export const createQuizLeadSchema = z.object({
  ...submissionMetaShape,
  answers: quizAnswersSchema,
  /** true: "Спросить Нурайым в WhatsApp" (help choosing); false: "Получить разбор в WhatsApp". */
  choose: z.boolean().default(false),
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
