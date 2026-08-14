import { checkTemperatureReading } from "@rtcom/business-rules";
import { prisma } from "@rtcom/db";
import type { Prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateDeviceApiKey, hashDeviceApiKey } from "../lib/device-auth";

const DEVICE_TYPES = [
  "RTCOM_1A",
  "RTCOM_1B",
  "RTCOM_1C",
  "RTCOM_2A",
  "RTCOM_2B",
  "RTCOM_2C",
  "RTCOM_3A",
] as const;

export default async function deviceRoutes(fastify: FastifyInstance) {
  // Registration/listing are ERP-facing and need staff auth.
  fastify.register(async (staffScope) => {
    staffScope.addHook("preHandler", fastify.authenticate);
    staffScope.addHook("preHandler", fastify.requireRole("ERP_ADMIN"));

    staffScope.post("/devices", async (request, reply) => {
      const body = z
        .object({ type: z.enum(DEVICE_TYPES), serialNumber: z.string().min(1), location: z.string().min(1) })
        .parse(request.body);

      const { plainKey, hash } = generateDeviceApiKey();
      const device = await prisma.device.create({
        data: { ...body, apiKeyHash: hash },
      });
      // The plain key is only ever shown once, at issuance — flash it to the
      // field technician provisioning the device, same as any API key.
      return reply.code(201).send({ ...device, apiKey: plainKey });
    });

    staffScope.get("/devices", async () => {
      return prisma.device.findMany({ orderBy: { type: "asc" } });
    });

    staffScope.get("/devices/:id/readings", async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return prisma.deviceReading.findMany({
        where: { deviceId: id },
        orderBy: { recordedAt: "desc" },
        take: 500,
      });
    });
  });

  // The readings webhook is called by the hardware itself, not a logged-in
  // staff member — authenticated by device API key, not a user JWT.
  fastify.post("/devices/:serialNumber/readings", async (request, reply) => {
    const { serialNumber } = z.object({ serialNumber: z.string() }).parse(request.params);
    const body = z.object({ payload: z.record(z.string(), z.unknown()) }).parse(request.body);
    const apiKey = request.headers["x-device-api-key"];

    if (typeof apiKey !== "string") {
      return reply.code(401).send({ error: "Missing X-Device-Api-Key header" });
    }

    const device = await prisma.device.findUnique({ where: { serialNumber } });
    if (!device || device.apiKeyHash !== hashDeviceApiKey(apiKey)) {
      return reply.code(401).send({ error: "Invalid device credentials" });
    }

    const now = new Date();
    const [reading] = await prisma.$transaction([
      prisma.deviceReading.create({
        data: { deviceId: device.id, payload: body.payload as Prisma.InputJsonValue, recordedAt: now },
      }),
      prisma.device.update({
        where: { id: device.id },
        data: { status: "ONLINE", lastSeenAt: now },
      }),
    ]);

    const alert = checkTemperatureReading(device, body.payload, now);
    if (alert) {
      // TODO: route to a real alerting channel (SMS/WhatsApp/push) once
      // provider credentials exist — logged for now so it's never silent.
      fastify.log.warn(alert, "Temperature out of safe range");
    }

    return reply.code(201).send({ reading, alert });
  });
}
