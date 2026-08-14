import { z } from "zod";
import { leadSourceSchema, leadStatusSchema } from "./enums";

export const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  source: leadSourceSchema,
  areaId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadStatusSchema = z.object({
  status: leadStatusSchema,
  notes: z.string().optional(),
});
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;

// Converting a lead creates a Customer + an initial Subscription in one step.
export const convertLeadSchema = z.object({
  routeId: z.string().optional(),
  address: z.string().min(1),
  dailyQuantityLitres: z.number().positive(),
  ratePerLitre: z.number().nonnegative().default(0),
  effectiveFrom: z.string().datetime(),
});
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
