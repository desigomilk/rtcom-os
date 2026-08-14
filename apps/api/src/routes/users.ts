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

  // Exists mainly so a placeholder phone (e.g. issued for an imported staff
  // record with no real number on file) can be corrected once known.
  fastify.patch("/users/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({ name: z.string().min(1).optional(), phone: z.string().min(10).max(15).optional() })
      .parse(request.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    if (body.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: body.phone } });
      if (existing && existing.id !== id) {
        return reply.code(409).send({ error: "Phone already registered" });
      }
    }

    return prisma.user.update({
      where: { id },
      data: { name: body.name, phone: body.phone },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
  });
}
