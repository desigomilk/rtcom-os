import { prisma } from "@rtcom/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEffectiveQuantityForDate } from "./delivery-exceptions";
import { BusinessRuleError } from "./errors";
import { applyChangeQuantity } from "./subscription";

describe("subscription quantity changes (integration, real Postgres)", () => {
  let customerId: string;
  const requestedAt = new Date("2026-02-01T10:00:00"); // before cutoff -> effective 2026-02-02

  beforeAll(async () => {
    const customer = await prisma.customer.create({
      data: {
        name: "Test Customer 2",
        phone: `8${Math.floor(100000000 + Math.random() * 899999999)}`,
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
    await prisma.subscription.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
  });

  it("rejects an effective date before the cutoff-computed date", async () => {
    await expect(
      applyChangeQuantity(
        {
          customerId,
          newDailyQuantityLitres: 3,
          effectiveFrom: "2026-02-01",
        },
        requestedAt,
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("creates a new subscription version without mutating the old one", async () => {
    await applyChangeQuantity(
      { customerId, newDailyQuantityLitres: 3, effectiveFrom: "2026-02-02" },
      requestedAt,
    );

    // Before the change takes effect, the old quantity still applies.
    expect(
      await getEffectiveQuantityForDate(customerId, new Date("2026-02-01")),
    ).toBe(2);
    // From the effective date onward, the new quantity applies.
    expect(
      await getEffectiveQuantityForDate(customerId, new Date("2026-02-02")),
    ).toBe(3);

    const versions = await prisma.subscription.count({ where: { customerId } });
    expect(versions).toBe(2);
  });
});
