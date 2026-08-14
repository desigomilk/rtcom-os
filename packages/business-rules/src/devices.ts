import { prisma } from "@rtcom/db";

// A device that hasn't reported in this long is presumed offline. Ten
// minutes comfortably covers a missed reading or two from a device that
// reports every 1-2 minutes (typical for temperature sensors) without
// flapping status on every brief network hiccup.
const OFFLINE_THRESHOLD_MINUTES = 10;

// Chiller/cold-room safe range — outside this, milk quality is at risk.
// A single shared threshold for now; per-device-type thresholds can be
// added once real field data shows they're needed.
const SAFE_TEMP_MIN_C = 2;
const SAFE_TEMP_MAX_C = 8;

export interface TemperatureAlert {
  deviceId: string;
  serialNumber: string;
  temperatureCelsius: number;
  recordedAt: Date;
}

// Devices don't block the workflow when they fail — this just surfaces what
// changed status so a caller can log/notify, per the notes' "koi device
// kharab ho jaye toh system rukta nahi — alert deta hai".
export async function checkDeviceHealth(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - OFFLINE_THRESHOLD_MINUTES * 60_000);

  const wentOffline = await prisma.device.findMany({
    where: {
      status: "ONLINE",
      OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null }],
    },
  });

  if (wentOffline.length > 0) {
    await prisma.device.updateMany({
      where: { id: { in: wentOffline.map((d) => d.id) } },
      data: { status: "OFFLINE" },
    });
  }

  return { wentOffline };
}

export function checkTemperatureReading(
  device: { id: string; serialNumber: string },
  payload: Record<string, unknown>,
  recordedAt: Date,
): TemperatureAlert | null {
  const temperatureCelsius = payload.temperatureCelsius;
  if (typeof temperatureCelsius !== "number") return null;
  if (temperatureCelsius >= SAFE_TEMP_MIN_C && temperatureCelsius <= SAFE_TEMP_MAX_C) {
    return null;
  }
  return {
    deviceId: device.id,
    serialNumber: device.serialNumber,
    temperatureCelsius,
    recordedAt,
  };
}
