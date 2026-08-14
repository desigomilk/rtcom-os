import { prisma } from "@rtcom/db";
import { userRoleSchema } from "@rtcom/shared-types";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ERP_ADMIN"));

  fastify.get("/users", async (request) => {
    const query = z.object({ role: userRoleSchema.optional() }).parse(request.query);
    return prisma.user.findMany({
      where: query.role ? { role: query.role } : undefined,
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
      orderBy: { name: "asc" },
    });
  });

  fastify.post("/users", async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(10).max(15),
        password: z.string().min(6),
        role: userRoleSchema,
      })
      .parse(request.body);

    const existing = await prisma.user.findUnique({ where: { phone: body.phone } });
    if (existing) return reply.code(409).send({ error: "Phone already registered" });

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: { name: body.name, phone: body.phone, passwordHash, role: body.role },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    return reply.code(201).send(user);
  });
}
