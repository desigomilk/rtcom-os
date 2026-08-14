import { prisma } from "@rtcom/db";
import type {
  AddExtraPayload,
  PauseSubscriptionPayload,
  ResumeSubscriptionPayload,
} from "@rtcom/shared-types";
import { computeEffectiveDate } from "./cutoff";
import { enumerateDates, startOfUtcDay } from "./dates";
import { BusinessRuleError } from "./errors";

function assertValidRange(fromDate: Date, toDate: Date, requestedAt: Date) {
  if (toDate < fromDate) {
    throw new BusinessRuleError("toDate must be on or after fromDate");
  }
  const effectiveDate = computeEffectiveDate(requestedAt);
  if (fromDate < effectiveDate) {
    throw new BusinessRuleError(
      `This change can only take effect from ${effectiveDate.toISOString().slice(0, 10)} onward (6:30 PM cutoff already passed for earlier dates)`,
    );
  }
}

// Applying an already-applied pause, or pausing a date that was never paused,
// are both harmless no-ops — upsert/deleteMany make this idempotent by design,
// which matters since a WhatsApp/voice intent might be confirmed twice.
export async function applyPauseDelivery(
  payload: PauseSubscriptionPayload,
  requestedAt: Date,
) {
  const fromDate = startOfUtcDay(new Date(payload.fromDate));
  const toDate = startOfUtcDay(new Date(payload.toDate));
  assertValidRange(fromDate, toDate, requestedAt);

  const dates = enumerateDates(fromDate, toDate);
  return prisma.$transaction(
    dates.map((date) =>
      prisma.deliveryDateException.upsert({
        where: { customerId_date: { customerId: payload.customerId, date } },
        create: { customerId: payload.customerId, date, type: "PAUSE" },
        update: { type: "PAUSE", extraQuantityLitres: null },
      }),
    ),
  );
}

export async function applyResumeDelivery(
  payload: ResumeSubscriptionPayload,
  requestedAt: Date,
) {
  const fromDate = startOfUtcDay(new Date(payload.fromDate));
  const toDate = startOfUtcDay(new Date(payload.toDate));
  assertValidRange(fromDate, toDate, requestedAt);

  return prisma.deliveryDateException.deleteMany({
    where: {
      customerId: payload.customerId,
      type: "PAUSE",
      date: { gte: fromDate, lte: toDate },
    },
  });
}

export async function applyAddExtra(
  payload: AddExtraPayload,
  requestedAt: Date,
) {
  const date = startOfUtcDay(new Date(payload.date));
  const effectiveDate = computeEffectiveDate(requestedAt);
  if (date < effectiveDate) {
    throw new BusinessRuleError(
      `Extra can only be added from ${effectiveDate.toISOString().slice(0, 10)} onward (6:30 PM cutoff already passed for earlier dates)`,
    );
  }

  return prisma.deliveryDateException.upsert({
    where: { customerId_date: { customerId: payload.customerId, date } },
    create: {
      customerId: payload.customerId,
      date,
      type: "EXTRA",
      extraQuantityLitres: payload.extraQuantityLitres,
    },
    update: {
      type: "EXTRA",
      extraQuantityLitres: payload.extraQuantityLitres,
    },
  });
}

// What a customer's actual delivery quantity should be on a given date, after
// layering the day's exception (if any) on top of the subscription in effect
// that day. This is the single source of truth the packaging/delivery
// manifest generation (Phase 3+) will call.
export async function getEffectiveQuantityForDate(
  customerId: string,
  date: Date,
) {
  const day = startOfUtcDay(date);

  const [subscription, exception] = await Promise.all([
    prisma.subscription.findFirst({
      where: { customerId, effectiveFrom: { lte: day }, status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.deliveryDateException.findUnique({
      where: { customerId_date: { customerId, date: day } },
    }),
  ]);

  const baseQuantity = subscription
    ? Number(subscription.dailyQuantityLitres)
    : 0;

  if (!exception) return baseQuantity;
  if (exception.type === "PAUSE") return 0;
  return baseQuantity + Number(exception.extraQuantityLitres ?? 0);
}
