import { prisma } from "@rtcom/db";
import { loginRequestSchema, refreshRequestSchema } from "@rtcom/shared-types";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { issueRefreshToken, verifyRefreshToken } from "../lib/refresh-token";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/login", async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { phone: body.phone },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid phone or password" });
    }

    const accessToken = fastify.jwt.sign({ sub: user.id, role: user.role });
    const { token: refreshToken, hash } = await issueRefreshToken(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hash },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = refreshRequestSchema.parse(request.body);
    const userId = refreshToken.split(".")[0];
    if (!userId) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshTokenHash) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    const isValid = await verifyRefreshToken(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!isValid) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    const accessToken = fastify.jwt.sign({ sub: user.id, role: user.role });
    const { token: newRefreshToken, hash } = await issueRefreshToken(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hash },
    });

    return { accessToken, refreshToken: newRefreshToken };
  });

  fastify.get(
    "/auth/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { id: true, name: true, phone: true, role: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });
      return user;
    },
  );
}
