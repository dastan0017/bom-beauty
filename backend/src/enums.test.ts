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
    ['RoutinePeriod', prisma.RoutinePeriod, shared.ROUTINE_PERIODS],
    ['ProgramVariant', prisma.ProgramVariant, shared.PROGRAM_VARIANTS],
  ] as const)('%s', (_name, prismaEnum, sharedValues) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...sharedValues].sort());
  });
});
