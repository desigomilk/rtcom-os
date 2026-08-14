import { getEffectiveQuantityForDate } from "@rtcom/business-rules";
import { prisma } from "@rtcom/db";
import {
  deliverySyncRequestSchema,
  routeHandoverSchema,
} from "@rtcom/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export default async function deliveryRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post(
    "/delivery/route-assignments",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const body = z
        .object({
          routeId: z.string(),
          deliveryBoyId: z.string(),
          date: z.string().date(),
        })
        .parse(request.body);

      const assignment = await prisma.routeAssignment.upsert({
        where: {
          routeId_date: { routeId: body.routeId, date: new Date(body.date) },
        },
        create: {
          routeId: body.routeId,
          deliveryBoyId: body.deliveryBoyId,
          date: new Date(body.date),
        },
        update: { deliveryBoyId: body.deliveryBoyId },
      });
      return reply.code(201).send(assignment);
    },
  );

  // Mid-route handover to a backup rider: repoints the day's assignment.
  // Stops already logged keep their original deliveryBoyId; new DeliveryLog
  // entries from the backup rider carry handedOverFromDeliveryBoyId (set by
  // the mobile client per the DeliverySyncEvent shape) so the switch stays
  // traceable in the record, not just in who's currently assigned.
  fastify.post(
    "/delivery/handover",
    { preHandler: fastify.requireRole("ERP_ADMIN", "DELIVERY_BOY") },
    async (request, reply) => {
      const body = routeHandoverSchema.parse(request.body);

      const assignment = await prisma.routeAssignment.findUnique({
        where: {
          routeId_date: {
            routeId: body.routeId,
            date: new Date(body.date),
          },
        },
      });
      if (!assignment) {
        return reply.code(404).send({ error: "No assignment for this route/date" });
      }
      if (assignment.deliveryBoyId !== body.fromDeliveryBoyId) {
        return reply
          .code(409)
          .send({ error: "fromDeliveryBoyId does not match the current assignment" });
      }

      const updated = await prisma.routeAssignment.update({
        where: { id: assignment.id },
        data: { deliveryBoyId: body.toDeliveryBoyId },
      });
      return updated;
    },
  );

  // The Delivery App's morning pull: everything needed to work the whole day
  // fully offline. expectedContainers is intentionally empty for now — exact
  // container-to-stop pre-allocation depends on the bottling-run traceability
  // module (not built yet); the sync endpoint below validates each scanned
  // QR against real Container rows regardless.
  fastify.get("/delivery/manifest", async (request, reply) => {
    const query = z.object({ date: z.string().date() }).parse(request.query);
    const date = new Date(query.date);

    const assignment = await prisma.routeAssignment.findFirst({
      where: { deliveryBoyId: request.user.sub, date },
      include: {
        route: {
          include: {
            stops: {
              orderBy: [{ sequenceOptimized: "asc" }, { sequence: "asc" }],
              include: { customer: true },
            },
          },
        },
      },
    });
    if (!assignment) {
      return reply.code(404).send({ error: "No route assigned for this date" });
    }

    const stops = await Promise.all(
      assignment.route.stops.map(async (stop) => {
        const [expectedQuantity, expectedEmptyContainers] = await Promise.all([
          getEffectiveQuantityForDate(stop.customerId, date),
          prisma.container.count({
            where: { currentCustomerId: stop.customerId, status: "DELIVERED" },
          }),
        ]);
        return {
          routeStopId: stop.id,
          sequence: stop.sequenceOptimized ?? stop.sequence,
          customerName: stop.customer.name,
          address: stop.customer.address,
          plannedLat: stop.plannedLat ? Number(stop.plannedLat) : undefined,
          plannedLng: stop.plannedLng ? Number(stop.plannedLng) : undefined,
          expectedQuantityLitres: expectedQuantity,
          expectedContainers: [] as { qrCode: string; variant: string }[],
          expectedEmptyContainers,
        };
      }),
    );

    return {
      date: query.date,
      routeId: assignment.routeId,
      stops,
    };
  });

  // Applies a batch of offline-captured delivery events. Each event's
  // clientEventId is the idempotency key (unique on DeliveryLog) — replaying
  // the same event after a partial/retried sync is a no-op, reported as
  // DUPLICATE rather than an error, since the Delivery App's outbox may retry
  // a batch it's not sure succeeded.
  fastify.post("/delivery/sync", async (request) => {
    const body = deliverySyncRequestSchema.parse(request.body);
    const results: Array<{
      clientEventId: string;
      status: "APPLIED" | "DUPLICATE" | "REJECTED";
      reason?: string;
    }> = [];

    for (const event of body.events) {
      const existing = await prisma.deliveryLog.findUnique({
        where: { clientEventId: event.clientEventId },
      });
      if (existing) {
        results.push({ clientEventId: event.clientEventId, status: "DUPLICATE" });
        continue;
      }

      const routeStop = await prisma.routeStop.findUnique({
        where: { id: event.routeStopId },
      });
      if (!routeStop) {
        results.push({
          clientEventId: event.clientEventId,
          status: "REJECTED",
          reason: "routeStopId not found",
        });
        continue;
      }

      const containers = await prisma.container.findMany({
        where: { qrCode: { in: event.containerScans.map((s) => s.containerQrCode) } },
      });
      const foundQrCodes = new Set(containers.map((c) => c.qrCode));
      const missing = event.containerScans
        .map((s) => s.containerQrCode)
        .filter((qr) => !foundQrCodes.has(qr));
      if (missing.length > 0 && !event.isManualOverride) {
        results.push({
          clientEventId: event.clientEventId,
          status: "REJECTED",
          reason: `Unknown container QR(s): ${missing.join(", ")}`,
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const log = await tx.deliveryLog.create({
          data: {
            routeStopId: event.routeStopId,
            deliveryBoyId: event.deliveryBoyId,
            date: new Date(event.date),
            status: event.status,
            emptyContainersReturned: event.emptyContainersReturned,
            scannedLat: event.scannedLat,
            scannedLng: event.scannedLng,
            isManualOverride: event.isManualOverride,
            overrideReason: event.overrideReason,
            overridePhotoUrl: event.overridePhotoUrl,
            handedOverFromDeliveryBoyId: event.handedOverFromDeliveryBoyId,
            clientEventId: event.clientEventId,
            scannedAt: new Date(event.scannedAt),
            syncedAt: new Date(),
          },
        });

        for (const container of containers) {
          await tx.deliveryContainerScan.create({
            data: { deliveryLogId: log.id, containerId: container.id },
          });
          await tx.container.update({
            where: { id: container.id },
            data: { status: "DELIVERED", currentCustomerId: routeStop.customerId },
          });
        }
      });

      results.push({ clientEventId: event.clientEventId, status: "APPLIED" });
    }

    return { results };
  });
}
