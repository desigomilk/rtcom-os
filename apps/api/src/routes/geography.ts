import { prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export default async function geographyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/cities", async () => {
    return prisma.city.findMany({ include: { areas: true }, orderBy: { name: "asc" } });
  });

  fastify.post(
    "/cities",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const body = z.object({ name: z.string().min(1) }).parse(request.body);
      const city = await prisma.city.create({ data: body });
      return reply.code(201).send(city);
    },
  );

  fastify.post(
    "/areas",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const body = z
        .object({ name: z.string().min(1), cityId: z.string() })
        .parse(request.body);
      const area = await prisma.area.create({ data: body });
      return reply.code(201).send(area);
    },
  );
}
