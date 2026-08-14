import { checkDeviceHealth } from "@rtcom/business-rules";

// Runs the device offline-detection sweep on an interval. Device *readings*
// arrive via the API's HTTP webhook (POST /devices/:serialNumber/readings) —
// hardware posts directly rather than through an MQTT broker, since that's
// what's actually deployable without standing up broker infrastructure this
// phase. This worker's only job is the health side: noticing when a device
// has gone quiet, which the ingestion endpoint itself can't do (it only
// hears from devices that ARE reporting).
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function runHealthCheck() {
  const { wentOffline } = await checkDeviceHealth();
  if (wentOffline.length > 0) {
    for (const device of wentOffline) {
      // TODO: route to a real alerting channel once provider credentials
      // exist — logged for now so a dead device is never silent.
      console.warn(
        `[device offline] ${device.type} ${device.serialNumber} at ${device.location} — last seen ${device.lastSeenAt?.toISOString() ?? "never"}`,
      );
    }
  }
}

async function main() {
  console.log(`iot-worker started, checking device health every ${CHECK_INTERVAL_MS / 1000}s`);
  await runHealthCheck();
  setInterval(() => {
    runHealthCheck().catch((error) => console.error("Health check failed:", error));
  }, CHECK_INTERVAL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
