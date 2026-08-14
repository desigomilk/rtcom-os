import { z } from "zod";
import { deliveryStopStatusSchema } from "./enums";

// One offline-captured delivery event for a single route stop. The Delivery App
// writes these to its local WatermelonDB outbox as they happen (fully offline)
// and flushes the outbox to POST /delivery/sync whenever connectivity returns.
// clientEventId is a client-generated UUID and is the idempotency key: replaying
// the same event after a retried/partial sync must be a no-op on the server.
export const deliverySyncEventSchema = z.object({
  clientEventId: z.string().uuid(),
  routeStopId: z.string(),
  deliveryBoyId: z.string(),
  date: z.string().date(),
  status: deliveryStopStatusSchema,
  containerScans: z.array(
    z.object({
      containerQrCode: z.string(),
      scannedAt: z.string().datetime(),
    }),
  ),
  // Each returned empty is scanned by its own QR, same as a filled delivery
  // scan — full traceability means knowing which physical bottle came back
  // from which customer, not just a headcount.
  emptyContainerScans: z.array(
    z.object({
      containerQrCode: z.string(),
      scannedAt: z.string().datetime(),
    }),
  ),
  scannedLat: z.number().min(-90).max(90).optional(),
  scannedLng: z.number().min(-180).max(180).optional(),
  isManualOverride: z.boolean().default(false),
  overrideReason: z.string().optional(),
  overridePhotoUrl: z.string().optional(),
  handedOverFromDeliveryBoyId: z.string().optional(),
  scannedAt: z.string().datetime(),
});
export type DeliverySyncEvent = z.infer<typeof deliverySyncEventSchema>;

export const deliverySyncRequestSchema = z.object({
  events: z.array(deliverySyncEventSchema).min(1).max(500),
});
export type DeliverySyncRequest = z.infer<typeof deliverySyncRequestSchema>;

export const deliverySyncResultSchema = z.object({
  results: z.array(
    z.object({
      clientEventId: z.string().uuid(),
      status: z.enum(["APPLIED", "DUPLICATE", "REJECTED"]),
      reason: z.string().optional(),
    }),
  ),
});
export type DeliverySyncResult = z.infer<typeof deliverySyncResultSchema>;

// Morning pull: everything the Delivery App needs to work fully offline for the day.
export const dailyRouteManifestSchema = z.object({
  date: z.string().date(),
  routeId: z.string(),
  stops: z.array(
    z.object({
      routeStopId: z.string(),
      sequence: z.number().int(),
      customerName: z.string(),
      address: z.string(),
      plannedLat: z.number().optional(),
      plannedLng: z.number().optional(),
      expectedContainers: z.array(
        z.object({ qrCode: z.string(), variant: z.string() }),
      ),
      expectedEmptyContainers: z.number().int().min(0),
    }),
  ),
});
export type DailyRouteManifest = z.infer<typeof dailyRouteManifestSchema>;

// Mid-route handover to a backup delivery person.
export const routeHandoverSchema = z.object({
  routeId: z.string(),
  date: z.string().date(),
  fromDeliveryBoyId: z.string(),
  toDeliveryBoyId: z.string(),
  handoverAt: z.string().datetime(),
});
export type RouteHandoverInput = z.infer<typeof routeHandoverSchema>;
