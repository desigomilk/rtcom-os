import { getEffectiveQuantityForDate } from "@rtcom/business-rules";
import { prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // Farm-side + plant-side quality tests for one day, side by side, with
  // mismatches surfaced first — the "daily testing report" the business asked
  // to see at a glance rather than digging through individual batch records.
  fastify.get("/reports/quality-today", async (request) => {
    const query = z.object({ date: z.string().date().optional() }).parse(request.query);
    const dateStr = query.date ?? new Date().toISOString().slice(0, 10);
    const { start, end } = dayRange(dateStr);

    const [farmEntries, plantReceipts] = await Promise.all([
      prisma.farmMilkEntry.findMany({
        where: { timestamp: { gte: start, lte: end } },
        include: { farm: true },
        orderBy: { timestamp: "desc" },
      }),
      prisma.plantReceipt.findMany({
        where: { receivedAt: { gte: start, lte: end } },
        include: { batch: true },
        orderBy: [{ mismatchFlag: "desc" }, { receivedAt: "desc" }],
      }),
    ]);

    return {
      date: dateStr,
      farmEntries,
      plantReceipts,
      mismatchCount: plantReceipts.filter((r) => r.mismatchFlag).length,
    };
  });

  // Delivered vs returned-empty counts for one day, overall and per route —
  // "kitni bottle deliver hui, kitni wapas aayi" at a glance.
  fastify.get("/reports/deliveries-today", async (request) => {
    const query = z.object({ date: z.string().date().optional() }).parse(request.query);
    const dateStr = query.date ?? new Date().toISOString().slice(0, 10);

    const logs = await prisma.deliveryLog.findMany({
      where: { date: new Date(dateStr) },
      include: {
        containerScans: true,
        routeStop: { include: { route: true } },
      },
    });

    const byRoute = new Map<
      string,
      { routeName: string; delivered: number; returned: number; complete: number; partial: number; issue: number }
    >();
    let delivered = 0;
    let returned = 0;
    const statusCounts = { PENDING: 0, COMPLETE: 0, PARTIAL: 0, ISSUE: 0 };

    for (const log of logs) {
      const routeName = log.routeStop.route.name;
      const entry = byRoute.get(routeName) ?? {
        routeName,
        delivered: 0,
        returned: 0,
        complete: 0,
        partial: 0,
        issue: 0,
      };
      const deliveredHere = log.containerScans.filter((s) => s.type === "DELIVERED").length;
      const returnedHere = log.containerScans.filter((s) => s.type === "RETURNED_EMPTY").length;
      entry.delivered += deliveredHere;
      entry.returned += returnedHere;
      delivered += deliveredHere;
      returned += returnedHere;
      statusCounts[log.status] += 1;
      if (log.status === "COMPLETE") entry.complete += 1;
      if (log.status === "PARTIAL") entry.partial += 1;
      if (log.status === "ISSUE") entry.issue += 1;
      byRoute.set(routeName, entry);
    }

    return {
      date: dateStr,
      totalDelivered: delivered,
      totalReturned: returned,
      statusCounts,
      routes: [...byRoute.values()],
    };
  });

  // Cash actually collected today (from recorded Payments) plus the milk
  // value physically delivered today (quantity x rate) as a separate,
  // clearly-labeled estimate — these are two different numbers and
  // conflating them would misstate either collections or output.
  fastify.get("/reports/revenue-today", async (request) => {
    const query = z.object({ date: z.string().date().optional() }).parse(request.query);
    const dateStr = query.date ?? new Date().toISOString().slice(0, 10);
    const { start, end } = dayRange(dateStr);

    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end } },
    });
    const cashCollectedToday = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const logs = await prisma.deliveryLog.findMany({
      where: { date: new Date(dateStr), status: { in: ["COMPLETE", "PARTIAL"] } },
      include: { routeStop: true },
    });

    // Priced by litres actually scheduled for delivery today (quantity x
    // rate), not by container count — a container isn't always exactly one
    // litre (500ml variants exist), so litres is the dimensionally correct
    // basis, and this reuses the same effective-quantity logic the manifest
    // and billing engine already rely on.
    const customerIds = [...new Set(logs.map((l) => l.routeStop.customerId))];
    const [subscriptions, quantities] = await Promise.all([
      prisma.subscription.findMany({
        where: { customerId: { in: customerIds }, status: "ACTIVE", effectiveFrom: { lte: end } },
        orderBy: { effectiveFrom: "desc" },
      }),
      Promise.all(
        customerIds.map(async (customerId) => ({
          customerId,
          litres: await getEffectiveQuantityForDate(customerId, start),
        })),
      ),
    ]);
    const rateByCustomer = new Map<string, number>();
    for (const sub of subscriptions) {
      if (!rateByCustomer.has(sub.customerId)) rateByCustomer.set(sub.customerId, Number(sub.ratePerLitre));
    }
    const litresByCustomer = new Map(quantities.map((q) => [q.customerId, q.litres]));

    let milkValueDeliveredToday = 0;
    for (const customerId of customerIds) {
      milkValueDeliveredToday +=
        (litresByCustomer.get(customerId) ?? 0) * (rateByCustomer.get(customerId) ?? 0);
    }

    return {
      date: dateStr,
      cashCollectedToday,
      paymentCount: payments.length,
      milkValueDeliveredToday,
    };
  });
}
