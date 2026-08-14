import { prisma } from "@rtcom/db";
import {
  confirmIntentSchema,
  intentStatusSchema,
  messageChannelSchema,
} from "@rtcom/shared-types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { confirmParsedIntent } from "../lib/confirm-intent";
import { matchConfirmationReply } from "../lib/confirmation-reply";
import { parseCustomerMessage } from "../lib/intent-parser";
import { sendCustomerMessage } from "../lib/outbound-message";

const inboundWebhookSchema = z.object({
  phone: z.string().min(10).max(15),
  channel: messageChannelSchema,
  body: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
});

export default async function messageRoutes(fastify: FastifyInstance) {
  // Unified inbound endpoint for both WhatsApp and voice-call transcripts.
  // Not RBAC-protected the way ERP routes are — this is a webhook meant to be
  // called by the WhatsApp Cloud API / telephony provider, which authenticate
  // differently (e.g. a signed request or a shared webhook secret to be added
  // once real provider credentials are configured).
  fastify.post("/webhooks/inbound-message", async (request, reply) => {
    const body = inboundWebhookSchema.parse(request.body);
    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();

    const customer = await prisma.customer.findUnique({
      where: { phone: body.phone },
    });

    if (!customer) {
      // Not an existing customer — treat as a new inquiry for the CRM funnel.
      // Notes describe the actual product explanation/subscription agreement
      // as human-led ("hamari team explain karti hai"), so this just gets the
      // inquiry into the Lead queue for a person to follow up, no AI needed.
      const existingLead = await prisma.lead.findFirst({
        where: { phone: body.phone, status: { not: "CONVERTED" } },
        orderBy: { createdAt: "desc" },
      });
      if (existingLead) {
        return reply.send({ status: "existing_lead", leadId: existingLead.id });
      }
      const lead = await prisma.lead.create({
        data: {
          name: body.phone,
          phone: body.phone,
          source: body.channel === "WHATSAPP" ? "WHATSAPP" : "CALL",
          notes: body.body,
        },
      });
      return reply.code(201).send({ status: "lead_created", leadId: lead.id });
    }

    const message = await prisma.customerMessage.create({
      data: {
        customerId: customer.id,
        channel: body.channel,
        direction: "IN",
        body: body.body,
        receivedAt,
      },
    });

    const confirmationReply = matchConfirmationReply(body.body);
    if (confirmationReply) {
      const pendingIntent = await prisma.parsedIntent.findFirst({
        where: {
          status: "PENDING_CONFIRMATION",
          message: { customerId: customer.id },
        },
        orderBy: { createdAt: "desc" },
      });
      if (pendingIntent) {
        const result = await confirmParsedIntent(
          pendingIntent.id,
          confirmationReply === "CONFIRM",
          body.channel,
        );
        await sendCustomerMessage(
          customer.id,
          body.channel,
          result.applied
            ? "Ho gaya — aapka request apply kar diya gaya hai."
            : result.error
              ? `Maaf kijiye, ye change apply nahi ho paya: ${result.error}`
              : "Theek hai, request cancel kar di gayi.",
        );
        return reply.send({ status: "confirmation_processed", ...result });
      }
    }

    const currentSubscription = await prisma.subscription.findFirst({
      where: { customerId: customer.id, status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    });

    const draft = await parseCustomerMessage(body.body, {
      customerName: customer.name,
      currentDailyQuantityLitres: currentSubscription
        ? Number(currentSubscription.dailyQuantityLitres)
        : 0,
    });

    if (!draft || draft.intentType === "OTHER" || draft.confidence < 0.6) {
      return reply.send({ status: "no_actionable_intent", messageId: message.id });
    }

    const { intentType, confidence, summaryForCustomer, ...payload } = draft;
    const parsedIntent = await prisma.parsedIntent.create({
      data: {
        messageId: message.id,
        intentType,
        payload,
        status: "PENDING_CONFIRMATION",
      },
    });

    await sendCustomerMessage(
      customer.id,
      body.channel,
      `${summaryForCustomer} — confirm karne ke liye "haan" reply karein, cancel ke liye "nahi".`,
    );

    return reply.code(201).send({ status: "intent_pending_confirmation", parsedIntentId: parsedIntent.id });
  });

  fastify.addHook("preHandler", (request, reply, done) => {
    // Everything below /intents/* is an ERP-facing view/action, unlike the
    // webhook above — require staff auth.
    if (request.url.startsWith("/intents")) {
      return fastify.authenticate(request, reply).then(() => done(), done);
    }
    done();
  });

  fastify.get("/intents", async (request) => {
    const query = z
      .object({ status: intentStatusSchema.optional() })
      .parse(request.query);
    return prisma.parsedIntent.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: { message: true, confirmation: true },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.post("/intents/:id/confirm", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = confirmIntentSchema.parse(request.body);

    const result = await confirmParsedIntent(
      id,
      body.confirmed,
      body.confirmationChannel,
    );
    if (result.error) return reply.code(400).send(result);
    return result;
  });
}
