import { prisma } from "@rtcom/db";
import { BusinessRuleError } from "./errors";

// Standard chart-of-accounts numbering (matches how most Indian SME
// accounting software — Tally et al. — lays out accounts): 1000s assets,
// 2000s liabilities, 3000s equity, 4000s income, 5000s expenses. Desigo's
// real chart (once they import their own books) can extend this freely —
// this seed just gives every other posting function something to point at
// so the ledger isn't empty on day one.
export const DEFAULT_ACCOUNTS: {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
}[] = [
  { code: "1000", name: "Cash in Hand", type: "ASSET" },
  { code: "1010", name: "Bank Account", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1200", name: "Inventory — Containers & Assets", type: "ASSET" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "2100", name: "Security Deposits Held (Customers)", type: "LIABILITY" },
  { code: "3000", name: "Owner's Capital", type: "EQUITY" },
  { code: "4000", name: "Milk Sales Revenue", type: "INCOME" },
  { code: "4100", name: "Penalty Income", type: "INCOME" },
  { code: "4200", name: "AMC Income", type: "INCOME" },
  { code: "5000", name: "Farm Procurement Cost", type: "EXPENSE" },
  { code: "5100", name: "Salaries & Wages", type: "EXPENSE" },
  { code: "5200", name: "Fuel & Transport", type: "EXPENSE" },
  { code: "5300", name: "Utilities", type: "EXPENSE" },
  { code: "5400", name: "Equipment Maintenance", type: "EXPENSE" },
  { code: "5900", name: "Miscellaneous Expense", type: "EXPENSE" },
];

export async function seedDefaultChartOfAccounts() {
  for (const account of DEFAULT_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      create: account,
      update: {},
    });
  }
  return prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } });
}

async function getAccountByCode(code: string) {
  const account = await prisma.chartOfAccount.findUnique({ where: { code } });
  if (!account) {
    throw new BusinessRuleError(
      `Chart of accounts is missing account ${code} — run the default seed first`,
    );
  }
  return account;
}

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
}

// The one gate every posting passes through: a journal entry that doesn't
// balance is a bug, not a business scenario, so this throws rather than
// silently accepting a broken entry.
export async function postJournalEntry(input: {
  date: Date;
  narration: string;
  sourceType: "MANUAL" | "INVOICE" | "PAYMENT" | "PENALTY" | "EXPENSE" | "OPENING_BALANCE";
  sourceId?: string;
  createdById?: string;
  lines: JournalLineInput[];
}) {
  const totalDebit = input.lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new BusinessRuleError(
      `Journal entry does not balance: debit ${totalDebit} != credit ${totalCredit}`,
    );
  }
  if (input.lines.length < 2) {
    throw new BusinessRuleError("A journal entry needs at least two lines");
  }

  return prisma.journalEntry.create({
    data: {
      date: input.date,
      narration: input.narration,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdById: input.createdById,
      lines: {
        create: input.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });
}

// Debit Accounts Receivable, credit revenue — invoiced but not yet collected.
// Penalty portions post to Penalty Income separately so the P&L shows them
// distinctly from milk sales.
export async function postInvoiceIssued(invoiceId: string, createdById?: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });
  if (!invoice) throw new BusinessRuleError(`Invoice ${invoiceId} not found`);

  const [ar, milkRevenue, penaltyIncome] = await Promise.all([
    getAccountByCode("1100"),
    getAccountByCode("4000"),
    getAccountByCode("4100"),
  ]);

  const milkAmount = invoice.lineItems
    .filter((l) => l.kind === "milk")
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const penaltyAmount = invoice.lineItems
    .filter((l) => l.kind === "penalty")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const lines: JournalLineInput[] = [
    { accountId: ar.id, debit: Number(invoice.totalAmount) },
  ];
  if (milkAmount > 0) lines.push({ accountId: milkRevenue.id, credit: milkAmount });
  if (penaltyAmount > 0) lines.push({ accountId: penaltyIncome.id, credit: penaltyAmount });

  return postJournalEntry({
    date: invoice.periodEnd,
    narration: `Invoice ${invoice.id} issued`,
    sourceType: "INVOICE",
    sourceId: invoice.id,
    createdById,
    lines,
  });
}

// Debit Cash/Bank, credit Accounts Receivable — money actually collected.
export async function postPaymentReceived(paymentId: string, createdById?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new BusinessRuleError(`Payment ${paymentId} not found`);

  const [ar, cash, bank] = await Promise.all([
    getAccountByCode("1100"),
    getAccountByCode("1000"),
    getAccountByCode("1010"),
  ]);
  const depositAccount = payment.method === "CASH" ? cash : bank;

  return postJournalEntry({
    date: payment.paidAt,
    narration: `Payment received (${payment.method}) for invoice ${payment.invoiceId}`,
    sourceType: "PAYMENT",
    sourceId: payment.id,
    createdById,
    lines: [
      { accountId: depositAccount.id, debit: Number(payment.amount) },
      { accountId: ar.id, credit: Number(payment.amount) },
    ],
  });
}

export async function recordExpense(input: {
  date: Date;
  accountId: string;
  paidFromAccountId: string;
  amount: number;
  description: string;
  vendorName?: string;
  createdById?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const journalEntry = await tx.journalEntry.create({
      data: {
        date: input.date,
        narration: input.description,
        sourceType: "EXPENSE",
        createdById: input.createdById,
        lines: {
          create: [
            { accountId: input.accountId, debit: input.amount },
            { accountId: input.paidFromAccountId, credit: input.amount },
          ],
        },
      },
    });
    return tx.expense.create({
      data: {
        date: input.date,
        accountId: input.accountId,
        paidFromAccountId: input.paidFromAccountId,
        amount: input.amount,
        description: input.description,
        vendorName: input.vendorName,
        journalEntryId: journalEntry.id,
      },
      include: { account: true, paidFromAccount: true },
    });
  });
}

// The ledger for one account (a "cash book" is just this called with the
// Cash account, a "bank book" with the Bank account) — running balance shown
// the conventional way: debit-natured accounts (asset/expense) increase on
// debit, credit-natured accounts (liability/equity/income) increase on credit.
export async function getAccountLedger(
  accountId: string,
  range?: { from?: Date; to?: Date },
) {
  const account = await prisma.chartOfAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new BusinessRuleError(`Account ${accountId} not found`);

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      journalEntry: {
        date: {
          gte: range?.from,
          lte: range?.to,
        },
      },
    },
    include: { journalEntry: true },
    orderBy: { journalEntry: { date: "asc" } },
  });

  const isDebitNatured = account.type === "ASSET" || account.type === "EXPENSE";
  let running = 0;
  const entries = lines.map((line) => {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    running += isDebitNatured ? debit - credit : credit - debit;
    return {
      journalEntryId: line.journalEntryId,
      date: line.journalEntry.date,
      narration: line.journalEntry.narration,
      debit,
      credit,
      balance: running,
    };
  });

  return { account, entries, closingBalance: running };
}

export async function getTrialBalance(asOfDate?: Date) {
  const accounts = await prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } });
  const rows = await Promise.all(
    accounts.map(async (account) => {
      const { closingBalance } = await getAccountLedger(account.id, { to: asOfDate });
      // closingBalance is already sign-normalized to each account's natural
      // side (see getAccountLedger) — a positive balance belongs on that
      // account's natural side of the trial balance, not on "debit" just
      // because the number is positive. An abnormal (negative) balance
      // shows on the opposite side, which is how a real trial balance
      // surfaces something worth investigating rather than hiding it.
      const isDebitNatured = account.type === "ASSET" || account.type === "EXPENSE";
      const debit = isDebitNatured
        ? Math.max(closingBalance, 0)
        : Math.max(-closingBalance, 0);
      const credit = isDebitNatured
        ? Math.max(-closingBalance, 0)
        : Math.max(closingBalance, 0);
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
      };
    }),
  );
  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 };
}

export async function getProfitAndLoss(periodStart: Date, periodEnd: Date) {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { type: { in: ["INCOME", "EXPENSE"] } },
    orderBy: { code: "asc" },
  });
  const rows = await Promise.all(
    accounts.map(async (account) => {
      const { closingBalance } = await getAccountLedger(account.id, {
        from: periodStart,
        to: periodEnd,
      });
      return { code: account.code, name: account.name, type: account.type, amount: closingBalance };
    }),
  );
  const totalIncome = rows.filter((r) => r.type === "INCOME").reduce((s, r) => s + r.amount, 0);
  const totalExpense = rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + r.amount, 0);
  return { rows, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
}

// Assets = Liabilities + Equity + (retained earnings from all-time P&L).
// Retained earnings is computed here rather than posted as closing entries —
// standard simplified treatment for a system that never "closes the books"
// at year-end via literal journal entries.
export async function getBalanceSheet(asOfDate: Date) {
  const [assetAccounts, liabilityAccounts, equityAccounts, pnl] = await Promise.all([
    prisma.chartOfAccount.findMany({ where: { type: "ASSET" }, orderBy: { code: "asc" } }),
    prisma.chartOfAccount.findMany({ where: { type: "LIABILITY" }, orderBy: { code: "asc" } }),
    prisma.chartOfAccount.findMany({ where: { type: "EQUITY" }, orderBy: { code: "asc" } }),
    getProfitAndLoss(new Date(0), asOfDate),
  ]);

  async function withBalances(accounts: { id: string; code: string; name: string }[]) {
    return Promise.all(
      accounts.map(async (a) => {
        const { closingBalance } = await getAccountLedger(a.id, { to: asOfDate });
        return { code: a.code, name: a.name, balance: closingBalance };
      }),
    );
  }

  const assets = await withBalances(assetAccounts);
  const liabilities = await withBalances(liabilityAccounts);
  const equity = await withBalances(equityAccounts);

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0) + pnl.netProfit;

  return {
    assets,
    liabilities,
    equity,
    retainedEarnings: pnl.netProfit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.005,
  };
}
