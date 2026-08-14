import { prisma } from "@rtcom/db";
import {
  convertLeadSchema,
  createLeadSchema,
  leadStatusSchema,
  updateLeadStatusSchema,
} from "@rtcom/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export default async function leadRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/leads", async (request, reply) => {
    const body = createLeadSchema.parse(request.body);
    const lead = await prisma.lead.create({
      data: {
        name: body.name,
        phone: body.phone,
        source: body.source,
        areaId: body.areaId,
        notes: body.notes,
        assignedToId: request.user.sub,
      },
    });
    return reply.code(201).send(lead);
  });

  fastify.get("/leads", async (request) => {
    const query = z
      .object({ status: leadStatusSchema.optional() })
      .parse(request.query);
    return prisma.lead.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.patch("/leads/:id/status", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateLeadStatusSchema.parse(request.body);

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: "Lead not found" });

    return prisma.lead.update({
      where: { id },
      data: { status: body.status, notes: body.notes ?? lead.notes },
    });
  });

  // Converts a qualified lead into a Customer + its first Subscription in one
  // step. This is the one place the CRM funnel hands off into the operational
  // (route/delivery/billing) side of the system.
  fastify.post(
    "/leads/:id/convert",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = convertLeadSchema.parse(request.body);

      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead) return reply.code(404).send({ error: "Lead not found" });
      if (lead.status === "CONVERTED") {
        return reply.code(409).send({ error: "Lead already converted" });
      }

      const result = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            name: lead.name,
            phone: lead.phone,
            address: body.address,
            routeId: body.routeId,
          },
        });
        await tx.subscription.create({
          data: {
            customerId: customer.id,
            dailyQuantityLitres: body.dailyQuantityLitres,
            ratePerLitre: body.ratePerLitre,
            status: "ACTIVE",
            effectiveFrom: new Date(body.effectiveFrom),
          },
        });
        await tx.lead.update({
          where: { id },
          data: { status: "CONVERTED", convertedCustomerId: customer.id },
        });
        return customer;
      });

      return reply.code(201).send(result);
    },
  );
}
