import * as shared from '@bom/shared';
import { describe, expect, it } from 'vitest';
import * as prisma from './generated/prisma/enums';

// Shared enums (packages/shared/src/enums.ts) must match the Prisma schema exactly.
describe('enum parity', () => {
  it.each([
    ['UserRole', prisma.UserRole, shared.USER_ROLES],
    ['OrderStatus', prisma.OrderStatus, shared.ORDER_STATUSES],
    ['OrderItemType', prisma.OrderItemType, shared.ORDER_ITEM_TYPES],
    ['PaymentMethod', prisma.PaymentMethod, shared.PAYMENT_METHODS],
    ['OrderPaymentStatus', prisma.OrderPaymentStatus, shared.ORDER_PAYMENT_STATUSES],
    ['PaymentStatus', prisma.PaymentStatus, shared.PAYMENT_STATUSES],
    ['PaymentPurpose', prisma.PaymentPurpose, shared.PAYMENT_PURPOSES],
    ['LeadKind', prisma.LeadKind, shared.LEAD_KINDS],
    ['QuizGoal', prisma.QuizGoal, shared.QUIZ_GOALS],
    ['SkinType', prisma.SkinType, shared.SKIN_TYPES],
    ['RoutinePeriod', prisma.RoutinePeriod, shared.ROUTINE_PERIODS],
  ] as const)('%s', (_name, prismaEnum, sharedValues) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...sharedValues].sort());
  });
});
