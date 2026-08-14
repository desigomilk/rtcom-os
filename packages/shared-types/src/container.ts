import { z } from "zod";
import { containerStatusSchema, containerTypeSchema } from "./enums";

export const containerSchema = z.object({
  id: z.string(),
  qrCode: z.string(),
  containerType: containerTypeSchema,
  variant: z.string(),
  sealColor: z.string().optional(),
  status: containerStatusSchema,
});
export type Container = z.infer<typeof containerSchema>;

// Reassigning a QR to a physical container (damaged/lost tag) — the old code is
// retired but the container's traceability history is preserved via the link.
export const reassignContainerQrSchema = z.object({
  containerId: z.string(),
  newQrCode: z.string().min(1),
  reason: z.string().min(1),
});
export type ReassignContainerQrInput = z.infer<
  typeof reassignContainerQrSchema
>;

// Public, no-login trace lookup: scan a container's QR and see its full
// farm -> batch -> chiller-blend -> bottling-run chain plus device readings.
export const containerTraceSchema = z.object({
  container: containerSchema,
  bottlingRun: z
    .object({
      id: z.string(),
      runAt: z.string().datetime(),
      chillerId: z.string(),
    })
    .nullable(),
  chillerBlends: z.array(
    z.object({
      farmId: z.string(),
      farmName: z.string(),
      percentContribution: z.number(),
    }),
  ),
  qualityTrail: z.array(
    z.object({
      recordedAt: z.string().datetime(),
      fat: z.number().optional(),
      snf: z.number().optional(),
      adulterationResult: z.unknown().optional(),
    }),
  ),
  temperatureTrail: z.array(
    z.object({
      recordedAt: z.string().datetime(),
      temperatureCelsius: z.number(),
      deviceId: z.string(),
    }),
  ),
});
export type ContainerTrace = z.infer<typeof containerTraceSchema>;
