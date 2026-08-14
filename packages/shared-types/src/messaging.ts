import { z } from "zod";
import { intentTypeSchema, messageChannelSchema } from "./enums";

// Inbound webhook payload — WhatsApp text or a voice-call transcript, normalized
// to the same shape before it reaches the intent parser.
export const inboundCustomerMessageSchema = z.object({
  customerId: z.string(),
  channel: messageChannelSchema,
  body: z.string().min(1),
  receivedAt: z.string().datetime(),
});
export type InboundCustomerMessage = z.infer<
  typeof inboundCustomerMessageSchema
>;

// What the AI layer is allowed to produce: a proposed structured change, never
// a direct write. Payload shape depends on intentType and is validated again
// by packages/business-rules before anything is applied.
export const parsedIntentSchema = z.object({
  messageId: z.string(),
  intentType: intentTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1).optional(),
});
export type ParsedIntentInput = z.infer<typeof parsedIntentSchema>;

export const pauseSubscriptionPayloadSchema = z.object({
  customerId: z.string(),
  fromDate: z.string().date(),
  toDate: z.string().date(),
});
export type PauseSubscriptionPayload = z.infer<
  typeof pauseSubscriptionPayloadSchema
>;

export const resumeSubscriptionPayloadSchema = z.object({
  customerId: z.string(),
  fromDate: z.string().date(),
  toDate: z.string().date(),
});
export type ResumeSubscriptionPayload = z.infer<
  typeof resumeSubscriptionPayloadSchema
>;

export const changeQuantityPayloadSchema = z.object({
  customerId: z.string(),
  newDailyQuantityLitres: z.number().positive(),
  effectiveFrom: z.string().date(),
});
export type ChangeQuantityPayload = z.infer<
  typeof changeQuantityPayloadSchema
>;

export const addExtraPayloadSchema = z.object({
  customerId: z.string(),
  date: z.string().date(),
  extraQuantityLitres: z.number().positive(),
});
export type AddExtraPayload = z.infer<typeof addExtraPayloadSchema>;

export const confirmIntentSchema = z.object({
  confirmed: z.boolean(),
  confirmationChannel: messageChannelSchema.default("WHATSAPP"),
});
export type ConfirmIntentInput = z.infer<typeof confirmIntentSchema>;
