import {
  getAccountLedger,
  getBalanceSheet,
  getProfitAndLoss,
  getTrialBalance,
  recordExpense,
  seedDefaultChartOfAccounts,
} from "@rtcom/business-rules";
import { prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export default async function accountingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ERP_ADMIN"));

  fastify.post("/accounting/seed", async () => {
    return seedDefaultChartOfAccounts();
  });

  fastify.get("/accounting/chart-of-accounts", async () => {
    return prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } });
  });

  fastify.get("/accounting/ledger/:accountId", async (request) => {
    const { accountId } = z.object({ accountId: z.string() }).parse(request.params);
    const query = z
      .object({ from: z.string().date().optional(), to: z.string().date().optional() })
      .parse(request.query);
    return getAccountLedger(accountId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  });

  fastify.get("/accounting/trial-balance", async (request) => {
    const query = z.object({ asOfDate: z.string().date().optional() }).parse(request.query);
    return getTrialBalance(query.asOfDate ? new Date(query.asOfDate) : undefined);
  });

  fastify.get("/accounting/profit-and-loss", async (request) => {
    const query = z
      .object({ periodStart: z.string().date(), periodEnd: z.string().date() })
      .parse(request.query);
    return getProfitAndLoss(new Date(query.periodStart), new Date(query.periodEnd));
  });

  fastify.get("/accounting/balance-sheet", async (request) => {
    const query = z.object({ asOfDate: z.string().date() }).parse(request.query);
    return getBalanceSheet(new Date(query.asOfDate));
  });

  fastify.post("/accounting/expenses", async (request, reply) => {
    const body = z
      .object({
        date: z.string().date(),
        accountId: z.string(),
        paidFromAccountId: z.string(),
        amount: z.number().positive(),
        description: z.string().min(1),
        vendorName: z.string().optional(),
      })
      .parse(request.body);
    const expense = await recordExpense({
      ...body,
      date: new Date(body.date),
      createdById: request.user.sub,
    });
    return reply.code(201).send(expense);
  });

  fastify.get("/accounting/expenses", async () => {
    return prisma.expense.findMany({
      include: { account: true, paidFromAccount: true },
      orderBy: { date: "desc" },
    });
  });
}
