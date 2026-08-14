import { prisma } from "@rtcom/db";
import { startOfUtcDay } from "./dates";

// Reconciles one delivery boy's day: how many empty containers they were
// expected to bring back (derived from customers' current holdings on their
// route stops that day) versus how many they actually scanned in. Idempotent
// per (deliveryBoyId, date) via the model's unique constraint — re-running
// after more logs sync in just updates the same row.
//
// "takenCount" here means containers taken from the hub as filled deliveries
// (a proxy — there's no separate hub-checkout scan yet, see schema.prisma
// comment); "deliveredCount" is containers actually scanned as delivered;
// "returnedCount" is empty containers scanned back in.
export async function reconcileDeliveryBoyDay(deliveryBoyId: string, date: Date) {
  const day = startOfUtcDay(date);

  const logs = await prisma.deliveryLog.findMany({
    where: { deliveryBoyId, date: day },
    include: { containerScans: true },
  });

  const deliveredCount = logs.reduce((sum, log) => sum + log.containerScans.length, 0);
  const returnedCount = logs.reduce((sum, log) => sum + log.emptyContainersReturned, 0);

  const routeStopIds = logs.map((l) => l.routeStopId);
  const customerIds = (
    await prisma.routeStop.findMany({
      where: { id: { in: routeStopIds } },
      select: { customerId: true },
    })
  ).map((s) => s.customerId);

  const expectedEmpty = await prisma.container.count({
    where: { currentCustomerId: { in: customerIds }, status: "DELIVERED" },
  });

  return prisma.emptyContainerReconciliation.upsert({
    where: { deliveryBoyId_date: { deliveryBoyId, date: day } },
    create: {
      deliveryBoyId,
      date: day,
      takenCount: deliveredCount,
      deliveredCount,
      returnedCount,
      discrepancy: expectedEmpty - returnedCount,
    },
    update: {
      takenCount: deliveredCount,
      deliveredCount,
      returnedCount,
      discrepancy: expectedEmpty - returnedCount,
    },
  });
}
