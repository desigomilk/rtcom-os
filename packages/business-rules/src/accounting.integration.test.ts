import { prisma } from "@rtcom/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateInvoice,
  issueInvoice,
  recordPayment,
} from "./billing";
import {
  getAccountLedger,
  getBalanceSheet,
  getProfitAndLoss,
  getTrialBalance,
  postJournalEntry,
  recordExpense,
  seedDefaultChartOfAccounts,
} from "./accounting";
import { BusinessRuleError } from "./errors";

describe("accounting (integration, real Postgres)", () => {
  let customerId: string;
  let cashAccountId: string;
  let expenseAccountId: string;

  beforeAll(async () => {
    const accounts = await seedDefaultChartOfAccounts();
    cashAccountId = accounts.find((a) => a.code === "1000")!.id;
    expenseAccountId = accounts.find((a) => a.code === "5900")!.id;

    const customer = await prisma.customer.create({
      data: {
        name: "Accounting Test Customer",
        phone: `7${Math.floor(100000000 + Math.random() * 899999999)}`,
        address: "Test address",
      },
    });
    customerId = customer.id;
    await prisma.subscription.create({
      data: {
        customerId,
        dailyQuantityLitres: 2,
        ratePerLitre: 60,
        status: "ACTIVE",
        effectiveFrom: new Date("2025-01-01"),
      },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { customerId } });
    const invoices = await prisma.invoice.findMany({ where: { customerId } });
    const invoiceIds = invoices.map((i) => i.id);
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
  });

  it("seeding the chart of accounts twice is idempotent", async () => {
    const first = await seedDefaultChartOfAccounts();
    const second = await seedDefaultChartOfAccounts();
    expect(second.length).toBe(first.length);
  });

  it("rejects an unbalanced journal entry", async () => {
    await expect(
      postJournalEntry({
        date: new Date("2026-04-01"),
        narration: "bad entry",
        sourceType: "MANUAL",
        lines: [
          { accountId: cashAccountId, debit: 100 },
          { accountId: expenseAccountId, credit: 50 },
        ],
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("full invoice -> issue -> payment cycle posts a balanced, correct ledger", async () => {
    const invoice = await generateInvoice(
      customerId,
      new Date("2026-04-01"),
      new Date("2026-04-05"),
    );
    // 5 days * 2 litres * ₹60/litre
    expect(Number(invoice.totalAmount)).toBe(600);
    expect(invoice.status).toBe("DRAFT");

    await issueInvoice(invoice.id);
    const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(issued.status).toBe("ISSUED");

    const arAccount = await prisma.chartOfAccount.findUniqueOrThrow({ where: { code: "1100" } });
    const revenueAccount = await prisma.chartOfAccount.findUniqueOrThrow({ where: { code: "4000" } });

    const arLedgerAfterIssue = await getAccountLedger(arAccount.id);
    expect(arLedgerAfterIssue.closingBalance).toBeGreaterThanOrEqual(600);

    const revenueLedger = await getAccountLedger(revenueAccount.id);
    expect(revenueLedger.closingBalance).toBeGreaterThanOrEqual(600);

    const arBalanceBeforePayment = arLedgerAfterIssue.closingBalance;
    await recordPayment(invoice.id, 600, "CASH");
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.status).toBe("PAID");

    const arLedgerAfterPayment = await getAccountLedger(arAccount.id);
    expect(arLedgerAfterPayment.closingBalance).toBe(arBalanceBeforePayment - 600);
  });

  it("rejects recording a payment against a draft (unissued) invoice", async () => {
    const invoice = await generateInvoice(
      customerId,
      new Date("2026-05-01"),
      new Date("2026-05-02"),
    );
    await expect(recordPayment(invoice.id, 120, "CASH")).rejects.toThrow(BusinessRuleError);
  });

  it("refuses to generate a duplicate invoice for the same period", async () => {
    await generateInvoice(customerId, new Date("2026-06-01"), new Date("2026-06-02"));
    await expect(
      generateInvoice(customerId, new Date("2026-06-01"), new Date("2026-06-02")),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("records an expense as a balanced journal entry reflected in P&L", async () => {
    const before = await getProfitAndLoss(new Date("2026-07-01"), new Date("2026-07-31"));
    await recordExpense({
      date: new Date("2026-07-15"),
      accountId: expenseAccountId,
      paidFromAccountId: cashAccountId,
      amount: 500,
      description: "Test diesel expense",
    });
    const after = await getProfitAndLoss(new Date("2026-07-01"), new Date("2026-07-31"));
    expect(after.totalExpense - before.totalExpense).toBe(500);
  });

  it("trial balance always balances", async () => {
    const trialBalance = await getTrialBalance();
    expect(trialBalance.balanced).toBe(true);
  });

  it("balance sheet always balances (assets = liabilities + equity)", async () => {
    const balanceSheet = await getBalanceSheet(new Date("2026-12-31"));
    expect(balanceSheet.balanced).toBe(true);
  });
});
