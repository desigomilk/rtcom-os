import { prisma } from "@rtcom/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BusinessRuleError } from "./errors";
import {
  applyAddExtra,
  applyPauseDelivery,
  applyResumeDelivery,
  getEffectiveQuantityForDate,
} from "./delivery-exceptions";

describe("delivery date exceptions (integration, real Postgres)", () => {
  let customerId: string;
  const requestedAt = new Date("2026-01-01T10:00:00"); // before cutoff -> effective 2026-01-02

  beforeAll(async () => {
    const customer = await prisma.customer.create({
      data: {
        name: "Test Customer",
        phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        address: "Test address",
      },
    });
    customerId = customer.id;

    await prisma.subscription.create({
      data: {
        customerId,
        dailyQuantityLitres: 2,
        status: "ACTIVE",
        effectiveFrom: new Date("2025-01-01"),
      },
    });
  });

  afterAll(async () => {
    await prisma.deliveryDateException.deleteMany({ where: { customerId } });
    await prisma.subscription.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
  });

  it("rejects a pause request whose start date is before the 6:30 PM cutoff's effective date", async () => {
    await expect(
      applyPauseDelivery(
        { customerId, fromDate: "2026-01-01", toDate: "2026-01-03" },
        requestedAt,
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("pauses delivery for a date range and zeroes the effective quantity", async () => {
    await applyPauseDelivery(
      { customerId, fromDate: "2026-01-02", toDate: "2026-01-03" },
      requestedAt,
    );

    expect(
      await getEffectiveQuantityForDate(customerId, new Date("2026-01-02")),
    ).toBe(0);
    expect(
      await getEffectiveQuantityForDate(customerId, new Date("2026-01-03")),
    ).toBe(0);
    // day after the paused range is unaffected
    expect(
      await getEffectiveQuantityForDate(customerId, new Date("2026-01-04")),
    ).toBe(2);
  });

  it("resuming removes the pause and restores the base quantity", async () => {
    await applyResumeDelivery(
      { customerId, fromDate: "2026-01-02", toDate: "2026-01-03" },
      requestedAt,
    );

    expect(
      await getEffectiveQuantityForDate(customerId, new Date("2026-01-02")),
    ).toBe(2);
  });

  it("adds an extra quantity on top of the base for a single date", async () => {
    await applyAddExtra(
      { customerId, date: "2026-01-05", extraQuantityLitres: 1 },
      requestedAt,
    );

    expect(
      await getEffectiveQuantityForDate(customerId, new Date("2026-01-05")),
    ).toBe(3);
  });

  it("re-applying the same pause twice is a no-op (idempotent)", async () => {
    await applyPauseDelivery(
      { customerId, fromDate: "2026-01-10", toDate: "2026-01-10" },
      requestedAt,
    );
    await applyPauseDelivery(
      { customerId, fromDate: "2026-01-10", toDate: "2026-01-10" },
      requestedAt,
    );

    const count = await prisma.deliveryDateException.count({
      where: { customerId, date: new Date("2026-01-10") },
    });
    expect(count).toBe(1);
  });
});
