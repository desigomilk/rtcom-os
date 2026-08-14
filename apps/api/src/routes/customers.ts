import { prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export default async function customerRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/customers", async () => {
    return prisma.customer.findMany({
      include: { route: true },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.get("/customers/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        route: true,
        subscriptions: { orderBy: { effectiveFrom: "desc" } },
        currentContainers: true,
        penaltyCharges: { orderBy: { appliedAt: "desc" }, take: 20 },
        invoices: { orderBy: { periodStart: "desc" }, take: 12 },
      },
    });
    if (!customer) return reply.code(404).send({ error: "Customer not found" });
    return customer;
  });

  fastify.patch(
    "/customers/:id/route",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ routeId: z.string().nullable() }).parse(request.body);
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) return reply.code(404).send({ error: "Customer not found" });
      return prisma.customer.update({ where: { id }, data: { routeId: body.routeId } });
    },
  );
}
