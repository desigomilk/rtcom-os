import { prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

// No auth on this route group — this is the customer-facing "scan the QR,
// see the trail" feature, meant to be reachable with no login.
export default async function publicRoutes(fastify: FastifyInstance) {
  fastify.get("/public/trace/:qrCode", async (request, reply) => {
    const { qrCode } = z.object({ qrCode: z.string() }).parse(request.params);

    const container = await prisma.container.findUnique({
      where: { qrCode },
      include: {
        bottlingRun: { include: { chiller: true } },
      },
    });
    if (!container) return reply.code(404).send({ error: "Container not found" });

    if (!container.bottlingRun) {
      return {
        container: {
          id: container.id,
          qrCode: container.qrCode,
          containerType: container.containerType,
          variant: container.variant,
          status: container.status,
        },
        bottlingRun: null,
        chillerBlends: [],
        qualityTrail: [],
        temperatureTrail: [],
      };
    }

    const blends = await prisma.chillerBlend.findMany({
      where: { chillerId: container.bottlingRun.chillerId },
      include: { farm: true, batch: { include: { plantReceipt: true } } },
      orderBy: { blendedAt: "desc" },
    });

    const qualityTrail = blends
      .filter((b) => b.batch.plantReceipt)
      .map((b) => ({
        recordedAt: b.batch.plantReceipt!.receivedAt,
        fat: Number(b.batch.plantReceipt!.fat),
        snf: Number(b.batch.plantReceipt!.snf),
        adulterationResult: b.batch.plantReceipt!.adulterationResult,
      }));

    return {
      container: {
        id: container.id,
        qrCode: container.qrCode,
        containerType: container.containerType,
        variant: container.variant,
        status: container.status,
      },
      bottlingRun: {
        id: container.bottlingRun.id,
        runAt: container.bottlingRun.runAt,
        chillerId: container.bottlingRun.chillerId,
        chillerName: container.bottlingRun.chiller.name,
      },
      chillerBlends: blends.map((b) => ({
        farmId: b.farmId,
        farmName: b.farm.name,
        farmVillage: b.farm.village,
        percentContribution: Number(b.percentContribution),
      })),
      qualityTrail,
      // Device-to-chiller linkage isn't modeled yet (Device.location is
      // free text, not a formal relation) — returning an empty trail here
      // rather than a fuzzy/unreliable match, since this is a customer-facing
      // trust feature where a wrong reading is worse than a missing one.
      temperatureTrail: [] as { recordedAt: Date; temperatureCelsius: number; deviceId: string }[],
    };
  });
}
