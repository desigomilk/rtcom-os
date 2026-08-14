import { prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

// Named routes-management.ts (not routes.ts) purely to avoid confusion with
// the domain concept of a delivery "Route" vs. this file being a Fastify
// route-registration module.
export default async function routesManagementRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/routes", async () => {
    return prisma.route.findMany({
      include: { area: { include: { city: true } }, _count: { select: { stops: true } } },
      orderBy: { name: "asc" },
    });
  });

  fastify.post(
    "/routes",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const body = z
        .object({ name: z.string().min(1), code: z.string().min(1), areaId: z.string().optional() })
        .parse(request.body);
      const route = await prisma.route.create({ data: body });
      return reply.code(201).send(route);
    },
  );

  fastify.get("/routes/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        area: { include: { city: true } },
        stops: { include: { customer: true }, orderBy: { sequence: "asc" } },
      },
    });
    if (!route) return reply.code(404).send({ error: "Route not found" });
    return route;
  });

  fastify.post(
    "/routes/:id/stops",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({ customerId: z.string(), sequence: z.number().int() })
        .parse(request.body);

      const stop = await prisma.routeStop.upsert({
        where: { routeId_customerId: { routeId: id, customerId: body.customerId } },
        create: { routeId: id, customerId: body.customerId, sequence: body.sequence },
        update: { sequence: body.sequence },
      });
      await prisma.customer.update({ where: { id: body.customerId }, data: { routeId: id } });
      return reply.code(201).send(stop);
    },
  );

  fastify.get(
    "/delivery-boys",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async () => {
      return prisma.user.findMany({
        where: { role: "DELIVERY_BOY" },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
      });
    },
  );
}
