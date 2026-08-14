import { z } from "zod";

export const userRoleSchema = z.enum([
  "ERP_ADMIN",
  "PLANT_STAFF",
  "FARM_STAFF",
  "DELIVERY_BOY",
]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const batchStatusSchema = z.enum(["AT_FARM", "IN_TRANSIT", "AT_PLANT"]);
export type BatchStatus = z.infer<typeof batchStatusSchema>;

export const barrelStatusSchema = z.enum([
  "AT_FARM_EMPTY",
  "AT_FARM_FILLED",
  "IN_TRANSIT_TO_PLANT",
  "AT_PLANT_EMPTIED",
  "IN_TRANSIT_TO_FARM",
]);
export type BarrelStatus = z.infer<typeof barrelStatusSchema>;

export const containerTypeSchema = z.enum(["BOTTLE", "BARREL", "JAR"]);
export type ContainerType = z.infer<typeof containerTypeSchema>;

export const containerStatusSchema = z.enum([
  "FILLED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "LOST",
]);
export type ContainerStatus = z.infer<typeof containerStatusSchema>;

export const deliveryStopStatusSchema = z.enum([
  "PENDING",
  "COMPLETE",
  "PARTIAL",
  "ISSUE",
]);
export type DeliveryStopStatus = z.infer<typeof deliveryStopStatusSchema>;

export const leadSourceSchema = z.enum([
  "WHATSAPP",
  "CALL",
  "REFERRAL",
  "OTHER",
]);
export type LeadSource = z.infer<typeof leadSourceSchema>;

export const leadStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
]);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const messageChannelSchema = z.enum(["WHATSAPP", "VOICE_CALL"]);
export type MessageChannel = z.infer<typeof messageChannelSchema>;

export const intentStatusSchema = z.enum([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "REJECTED",
  "EXPIRED",
]);
export type IntentStatus = z.infer<typeof intentStatusSchema>;

export const intentTypeSchema = z.enum([
  "PAUSE_SUBSCRIPTION",
  "RESUME_SUBSCRIPTION",
  "CHANGE_QUANTITY",
  "ADD_EXTRA",
  "OTHER",
]);
export type IntentType = z.infer<typeof intentTypeSchema>;

export const paymentMethodSchema = z.enum(["UPI", "QR", "CASH", "BANK"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
