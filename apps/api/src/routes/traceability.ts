import { prisma } from "@rtcom/db";
import {
  batchStatusSchema,
  containerStatusSchema,
  containerTypeSchema,
} from "@rtcom/shared-types";
import type { Prisma } from "@rtcom/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

// Fat/SNF readings within this tolerance of the farm's own reading aren't
// flagged — instrument variance between farm and plant testers is normal;
// anything beyond it is worth a human look (adulteration, mislabeled batch).
const QUALITY_MISMATCH_TOLERANCE = 0.2;

export default async function traceabilityRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ---------- Farms ----------

  fastify.get("/farms", async () => {
    return prisma.farm.findMany({ orderBy: { name: "asc" } });
  });

  fastify.post(
    "/farms",
    { preHandler: fastify.requireRole("ERP_ADMIN") },
    async (request, reply) => {
      const body = z
        .object({ name: z.string().min(1), ownerName: z.string().min(1), phone: z.string().min(10), village: z.string().min(1) })
        .parse(request.body);
      const farm = await prisma.farm.create({ data: body });
      return reply.code(201).send(farm);
    },
  );

  // ---------- Farm milk entries ----------

  fastify.post(
    "/farm-milk-entries",
    { preHandler: fastify.requireRole("FARM_STAFF", "ERP_ADMIN") },
    async (request, reply) => {
      const body = z
        .object({
          farmId: z.string(),
          litres: z.number().positive(),
          fat: z.number().nonnegative(),
          snf: z.number().nonnegative(),
          adulterationResult: z.unknown().optional(),
          batchId: z.string().optional(),
        })
        .parse(request.body);
      const entry = await prisma.farmMilkEntry.create({
        data: {
          ...body,
          adulterationResult: body.adulterationResult as Prisma.InputJsonValue,
          enteredById: request.user.sub,
        },
      });
      return reply.code(201).send(entry);
    },
  );

  fastify.get("/farm-milk-entries", async (request) => {
    const query = z
      .object({ farmId: z.string().optional(), batchId: z.string().optional() })
      .parse(request.query);
    return prisma.farmMilkEntry.findMany({
      where: { farmId: query.farmId, batchId: query.batchId },
      orderBy: { timestamp: "desc" },
    });
  });

  // ---------- Batches (farm -> plant transit) ----------

  fastify.post(
    "/batches",
    { preHandler: fastify.requireRole("FARM_STAFF", "ERP_ADMIN") },
    async (request, reply) => {
      const body = z.object({ qrCode: z.string().min(1) }).parse(request.body);
      const batch = await prisma.batch.create({ data: { qrCode: body.qrCode } });
      return reply.code(201).send(batch);
    },
  );

  fastify.get("/batches", async (request) => {
    const query = z.object({ status: batchStatusSchema.optional() }).parse(request.query);
    return prisma.batch.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.get("/batches/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        farmMilkEntries: { include: { farm: true } },
        plantReceipt: true,
        chillerBlends: { include: { chiller: true } },
      },
    });
    if (!batch) return reply.code(404).send({ error: "Batch not found" });
    return batch;
  });

  fastify.post(
    "/batches/:id/dispatch",
    { preHandler: fastify.requireRole("FARM_STAFF", "ERP_ADMIN") },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) return reply.code(404).send({ error: "Batch not found" });
      return prisma.batch.update({
        where: { id },
        data: { status: "IN_TRANSIT", dispatchedAt: new Date() },
      });
    },
  );

  // Plant re-tests the batch on arrival. Auto-flags a mismatch against the
  // farm's own reading (averaged across that batch's entries) — this is the
  // fraud/quality-drift check the notes describe ("farm aur plant ke test
  // alag nikle toh system khud alarm uthata hai").
  fastify.post(
    "/batches/:id/receive",
    { preHandler: fastify.requireRole("PLANT_STAFF", "ERP_ADMIN") },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({ fat: z.number().nonnegative(), snf: z.number().nonnegative(), adulterationResult: z.unknown().optional() })
        .parse(request.body);

      const batch = await prisma.batch.findUnique({
        where: { id },
        include: { farmMilkEntries: true },
      });
      if (!batch) return reply.code(404).send({ error: "Batch not found" });
      if (batch.farmMilkEntries.length === 0) {
        return reply.code(400).send({ error: "Batch has no farm milk entries to compare against" });
      }

      const avgFat =
        batch.farmMilkEntries.reduce((s, e) => s + Number(e.fat), 0) / batch.farmMilkEntries.length;
      const avgSnf =
        batch.farmMilkEntries.reduce((s, e) => s + Number(e.snf), 0) / batch.farmMilkEntries.length;
      const mismatchFlag =
        Math.abs(avgFat - body.fat) > QUALITY_MISMATCH_TOLERANCE ||
        Math.abs(avgSnf - body.snf) > QUALITY_MISMATCH_TOLERANCE;

      const [receipt] = await prisma.$transaction([
        prisma.plantReceipt.create({
          data: {
            batchId: id,
            fat: body.fat,
            snf: body.snf,
            adulterationResult: body.adulterationResult as Prisma.InputJsonValue,
            mismatchFlag,
            mismatchNotes: mismatchFlag
              ? `Farm avg fat/snf ${avgFat.toFixed(2)}/${avgSnf.toFixed(2)} vs plant ${body.fat}/${body.snf}`
              : null,
            receivedById: request.user.sub,
          },
        }),
        prisma.batch.update({ where: { id }, data: { status: "AT_PLANT" } }),
      ]);
      return reply.code(201).send(receipt);
    },
  );

  // ---------- Chillers ----------

  fastify.get("/chillers", async () => {
    return prisma.chiller.findMany({ orderBy: { name: "asc" } });
  });

  fastify.post(
    "/chillers",
    { preHandler: fastify.requireRole("PLANT_STAFF", "ERP_ADMIN") },
    async (request, reply) => {
      const body = z
        .object({ name: z.string().min(1), capacityLitres: z.number().positive() })
        .parse(request.body);
      const chiller = await prisma.chiller.create({ data: body });
      return reply.code(201).send(chiller);
    },
  );

  fastify.get("/chillers/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const chiller = await prisma.chiller.findUnique({
      where: { id },
      include: { blends: { include: { farm: true, batch: true }, orderBy: { blendedAt: "desc" } } },
    });
    if (!chiller) return reply.code(404).send({ error: "Chiller not found" });
    return chiller;
  });

  // Blends a received batch's milk into a chiller — a batch groups
  // FarmMilkEntries which may span more than one farm, so this creates one
  // ChillerBlend row per farm found in the batch, with percentContribution
  // computed against the chiller's total volume so far (including history).
  fastify.post(
    "/chillers/:id/blend",
    { preHandler: fastify.requireRole("PLANT_STAFF", "ERP_ADMIN") },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ batchId: z.string() }).parse(request.body);

      const [chiller, batch, existingBlends] = await Promise.all([
        prisma.chiller.findUnique({ where: { id } }),
        prisma.batch.findUnique({ where: { id: body.batchId }, include: { farmMilkEntries: true } }),
        prisma.chillerBlend.findMany({ where: { chillerId: id } }),
      ]);
      if (!chiller) return reply.code(404).send({ error: "Chiller not found" });
      if (!batch) return reply.code(404).send({ error: "Batch not found" });

      const litresByFarm = new Map<string, number>();
      for (const entry of batch.farmMilkEntries) {
        litresByFarm.set(entry.farmId, (litresByFarm.get(entry.farmId) ?? 0) + Number(entry.litres));
      }

      const priorTotal = existingBlends.reduce((s, b) => s + Number(b.litres), 0);
      const newTotal = priorTotal + [...litresByFarm.values()].reduce((s, l) => s + l, 0);

      const created = await prisma.$transaction(
        [...litresByFarm.entries()].map(([farmId, litres]) =>
          prisma.chillerBlend.create({
            data: {
              chillerId: id,
              batchId: body.batchId,
              farmId,
              litres,
              percentContribution: newTotal > 0 ? (litres / newTotal) * 100 : 0,
            },
          }),
        ),
      );
      return reply.code(201).send(created);
    },
  );

  // ---------- Bottling ----------

  fastify.post(
    "/bottling-runs",
    { preHandler: fastify.requireRole("PLANT_STAFF", "ERP_ADMIN") },
    async (request, reply) => {
      const body = z
        .object({
          chillerId: z.string(),
          manualCount: z.number().int().positive(),
          cameraCount: z.number().int().optional(),
          containers: z.array(
            z.object({
              qrCode: z.string().min(1),
              containerType: containerTypeSchema,
              variant: z.string().min(1),
              sealColor: z.string().optional(),
            }),
          ),
        })
        .parse(request.body);

      const mismatchFlag =
        body.cameraCount !== undefined && body.cameraCount !== body.manualCount;

      // Containers are physical, reusable bottles/barrels — the same qrCode
      // gets filled many times over its life (wash -> refill -> deliver ->
      // return -> wash again), so this must upsert by qrCode rather than
      // always creating a new row (which would fail on the unique qrCode
      // constraint the very first time a bottle came back for a refill).
      // A container found mid-cycle (still DELIVERED/IN_TRANSIT) getting
      // refilled anyway is flagged, not blocked — the empty-return step was
      // likely skipped somewhere, which is exactly the kind of gap this
      // system should surface rather than silently paper over.
      const result = await prisma.$transaction(async (tx) => {
        const run = await tx.bottlingRun.create({
          data: {
            chillerId: body.chillerId,
            manualCount: body.manualCount,
            cameraCount: body.cameraCount,
            mismatchFlag,
            staffId: request.user.sub,
          },
        });

        const containers = await Promise.all(
          body.containers.map(async (c) => {
            const existing = await tx.container.findUnique({ where: { qrCode: c.qrCode } });
            const refilledWithoutReturn =
              !!existing && !["FILLED", "RETURNED", "LOST"].includes(existing.status);

            const container = await tx.container.upsert({
              where: { qrCode: c.qrCode },
              create: {
                qrCode: c.qrCode,
                containerType: c.containerType,
                variant: c.variant,
                sealColor: c.sealColor,
                status: "FILLED",
                bottlingRunId: run.id,
              },
              update: {
                containerType: c.containerType,
                variant: c.variant,
                sealColor: c.sealColor,
                status: "FILLED",
                bottlingRunId: run.id,
                currentCustomerId: null,
              },
            });
            return { container, refilledWithoutReturn };
          }),
        );

        return { run, containers };
      });

      const anomalies = result.containers.filter((c) => c.refilledWithoutReturn);
      if (anomalies.length > 0) {
        fastify.log.warn(
          { qrCodes: anomalies.map((a) => a.container.qrCode) },
          "Container(s) refilled without going through an empty-return scan first",
        );
      }

      return reply.code(201).send({
        ...result.run,
        containers: result.containers.map((c) => c.container),
        refilledWithoutReturn: anomalies.map((a) => a.container.qrCode),
      });
    },
  );

  fastify.get("/bottling-runs", async () => {
    return prisma.bottlingRun.findMany({
      include: { chiller: true, _count: { select: { containers: true } } },
      orderBy: { runAt: "desc" },
    });
  });

  fastify.get("/containers", async (request) => {
    const query = z.object({ status: containerStatusSchema.optional() }).parse(request.query);
    return prisma.container.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });
}
