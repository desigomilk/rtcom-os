import { prisma } from "@rtcom/db";
import { postInvoiceIssued, postPaymentReceived } from "./accounting";
import { enumerateDates, startOfUtcDay } from "./dates";
import { BusinessRuleError } from "./errors";

const PENALTY_AMOUNTS = {
  UNRETURNED_BOTTLE_DAILY: 0.8,
  LOST_BOTTLE: 45,
  LOST_BARREL: 15000,
  AMC: 100,
} as const;

async function getMilkAmountForDate(customerId: string, date: Date) {
  const [subscription, exception] = await Promise.all([
    prisma.subscription.findFirst({
      where: { customerId, effectiveFrom: { lte: date }, status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.deliveryDateException.findUnique({
      where: { customerId_date: { customerId, date } },
    }),
  ]);

  if (!subscription) return 0;
  const rate = Number(subscription.ratePerLitre);
  const baseQuantity = Number(subscription.dailyQuantityLitres);

  if (exception?.type === "PAUSE") return 0;
  const quantity =
    exception?.type === "EXTRA"
      ? baseQuantity + Number(exception.extraQuantityLitres ?? 0)
      : baseQuantity;
  return quantity * rate;
}

// Generates a monthly-style invoice for a customer: one line item for milk
// (summed day by day, since quantity/rate can change mid-period via
// versioned subscriptions and per-date exceptions) plus one line item per
// penalty charge applied within the period. Rates default to 0 until real
// pricing data is imported — see Subscription.ratePerLitre.
export async function generateInvoice(
  customerId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const existing = await prisma.invoice.findUnique({
    where: {
      customerId_periodStart_periodEnd: { customerId, periodStart, periodEnd },
    },
  });
  if (existing) {
    throw new BusinessRuleError(
      `Invoice already exists for this customer and period (${existing.id})`,
    );
  }

  const dates = enumerateDates(periodStart, periodEnd);
  const dailyAmounts = await Promise.all(
    dates.map((date) => getMilkAmountForDate(customerId, date)),
  );
  const milkAmount = dailyAmounts.reduce((sum, amount) => sum + amount, 0);

  const penalties = await prisma.penaltyCharge.findMany({
    where: { customerId, appliedAt: { gte: periodStart, lte: periodEnd } },
  });
  const penaltyTotal = penalties.reduce((sum, p) => sum + Number(p.amount), 0);

  const totalAmount = milkAmount + penaltyTotal;

  return prisma.invoice.create({
    data: {
      customerId,
      periodStart,
      periodEnd,
      totalAmount,
      status: "DRAFT",
      lineItems: {
        create: [
          {
            description: `Milk, ${dates.length} day(s)`,
            amount: milkAmount,
            kind: "milk",
          },
          ...penalties.map((p) => ({
            description: p.notes ?? p.type,
            amount: Number(p.amount),
            kind: "penalty",
          })),
        ],
      },
    },
    include: { lineItems: true },
  });
}

// Moves a DRAFT invoice to ISSUED and posts it to the general ledger
// (Debit Accounts Receivable, Credit revenue) — a draft isn't a real
// accounting transaction yet, only an issued one is.
export async function issueInvoice(invoiceId: string, createdById?: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new BusinessRuleError(`Invoice ${invoiceId} not found`);
  if (invoice.status !== "DRAFT") {
    throw new BusinessRuleError(`Invoice ${invoiceId} is already ${invoice.status}`);
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "ISSUED" },
  });
  await postInvoiceIssued(invoiceId, createdById);
  return updated;
}

export async function recordPayment(
  invoiceId: string,
  amount: number,
  method: "UPI" | "QR" | "CASH" | "BANK",
  referenceId?: string,
  createdById?: string,
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) throw new BusinessRuleError(`Invoice ${invoiceId} not found`);
  if (invoice.status === "DRAFT") {
    throw new BusinessRuleError("Cannot record a payment against a draft invoice — issue it first");
  }

  const payment = await prisma.payment.create({
    data: { invoiceId, amount, method, referenceId },
  });
  await postPaymentReceived(payment.id, createdById);

  const totalPaid =
    invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) + amount;
  const newStatus =
    totalPaid >= Number(invoice.totalAmount) ? "PAID" : "PARTIALLY_PAID";
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });

  return payment;
}

// Manually-triggered flat-fee penalties (lost bottle/barrel, AMC) — these
// depend on a physical determination (staff finds a container missing, or
// the yearly AMC cycle comes up), not something derivable from delivery data.
export async function applyFlatPenalty(
  customerId: string,
  type: "LOST_BOTTLE" | "LOST_BARREL" | "AMC",
  notes?: string,
) {
  return prisma.penaltyCharge.create({
    data: { customerId, type, amount: PENALTY_AMOUNTS[type], notes },
  });
}

// Daily batch job (call once per day, e.g. via cron): charges ₹0.80 for every
// container still sitting with a customer, undedup'd by the
// (customerId, type, relatedContainerId, periodDate) unique constraint so
// re-running this for the same day is a safe no-op.
export async function applyDailyUnreturnedPenalties(date: Date) {
  const day = startOfUtcDay(date);
  const heldContainers = await prisma.container.findMany({
    where: { status: "DELIVERED", currentCustomerId: { not: null } },
  });

  const results = [];
  for (const container of heldContainers) {
    if (!container.currentCustomerId) continue;
    try {
      const charge = await prisma.penaltyCharge.create({
        data: {
          customerId: container.currentCustomerId,
          type: "UNRETURNED_BOTTLE_DAILY",
          amount: PENALTY_AMOUNTS.UNRETURNED_BOTTLE_DAILY,
          relatedContainerId: container.id,
          periodDate: day,
          appliedAt: day,
        },
      });
      results.push(charge);
    } catch (error) {
      // Unique constraint hit (already charged for this container today) — skip.
      if (!(error instanceof Object && "code" in error && error.code === "P2002")) {
        throw error;
      }
    }
  }
  return results;
}
