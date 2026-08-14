import {
  applyDailyUnreturnedPenalties,
  applyFlatPenalty,
  generateInvoice,
  issueInvoice,
  recordPayment,
} from "@rtcom/business-rules";
import { reconcileDeliveryBoyDay } from "@rtcom/business-rules";
import { prisma } from "@rtcom/db";
import { paymentMethodSchema } from "@rtcom/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export default async function billingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ERP_ADMIN"));

  fastify.post("/billing/invoices", async (request, reply) => {
    const body = z
      .object({ customerId: z.string(), periodStart: z.string().date(), periodEnd: z.string().date() })
      .parse(request.body);
    const invoice = await generateInvoice(
      body.customerId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
    return reply.code(201).send(invoice);
  });

  fastify.get("/billing/invoices", async (request) => {
    const query = z.object({ customerId: z.string().optional() }).parse(request.query);
    return prisma.invoice.findMany({
      where: query.customerId ? { customerId: query.customerId } : undefined,
      include: { lineItems: true, payments: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.post("/billing/invoices/:id/issue", async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return issueInvoice(id, request.user.sub);
  });

  fastify.post("/billing/invoices/:id/payments", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({ amount: z.number().positive(), method: paymentMethodSchema, referenceId: z.string().optional() })
      .parse(request.body);
    const payment = await recordPayment(id, body.amount, body.method, body.referenceId, request.user.sub);
    return reply.code(201).send(payment);
  });

  fastify.post("/billing/penalties", async (request, reply) => {
    const body = z
      .object({
        customerId: z.string(),
        type: z.enum(["LOST_BOTTLE", "LOST_BARREL", "AMC"]),
        notes: z.string().optional(),
      })
      .parse(request.body);
    const penalty = await applyFlatPenalty(body.customerId, body.type, body.notes);
    return reply.code(201).send(penalty);
  });

  // Idempotent per (customer, container, day) — safe to trigger repeatedly
  // from an external cron for the given date.
  fastify.post("/billing/apply-daily-penalties", async (request) => {
    const body = z.object({ date: z.string().date() }).parse(request.body);
    const charges = await applyDailyUnreturnedPenalties(new Date(body.date));
    return { applied: charges.length };
  });

  fastify.post("/billing/reconcile", async (request) => {
    const body = z
      .object({ deliveryBoyId: z.string(), date: z.string().date() })
      .parse(request.body);
    return reconcileDeliveryBoyDay(body.deliveryBoyId, new Date(body.date));
  });

  fastify.get("/billing/reconciliations", async (request) => {
    const query = z.object({ date: z.string().date() }).parse(request.query);
    return prisma.emptyContainerReconciliation.findMany({
      where: { date: new Date(query.date) },
      include: { deliveryBoy: { select: { id: true, name: true } } },
    });
  });
}
