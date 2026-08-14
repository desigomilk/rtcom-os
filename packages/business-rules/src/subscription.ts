import { prisma } from "@rtcom/db";
import type { ChangeQuantityPayload } from "@rtcom/shared-types";
import { computeEffectiveDate } from "./cutoff";
import { startOfUtcDay } from "./dates";
import { BusinessRuleError } from "./errors";

// A permanent quantity change creates a new Subscription version rather than
// mutating the current one, so "what was the plan on date X" stays answerable
// from history (see the Subscription model comment in schema.prisma).
export async function applyChangeQuantity(
  payload: ChangeQuantityPayload,
  requestedAt: Date,
) {
  const effectiveFrom = startOfUtcDay(new Date(payload.effectiveFrom));
  const effectiveDate = computeEffectiveDate(requestedAt);
  if (effectiveFrom < effectiveDate) {
    throw new BusinessRuleError(
      `Quantity change can only take effect from ${effectiveDate.toISOString().slice(0, 10)} onward (6:30 PM cutoff already passed for earlier dates)`,
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: payload.customerId },
  });
  if (!customer) {
    throw new BusinessRuleError(`Customer ${payload.customerId} not found`);
  }

  return prisma.subscription.create({
    data: {
      customerId: payload.customerId,
      dailyQuantityLitres: payload.newDailyQuantityLitres,
      status: "ACTIVE",
      effectiveFrom,
    },
  });
}
