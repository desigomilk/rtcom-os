import { randomBytes, createHash } from "node:crypto";

// Device API keys are high-entropy random tokens, not human passwords, so a
// fast deterministic hash (SHA-256) is appropriate here — unlike user
// passwords/refresh tokens (bcrypt, see lib/refresh-token.ts), there's no
// low-entropy brute-force risk to slow down, and readings may arrive
// frequently enough that bcrypt's deliberate slowness would add up.
export function generateDeviceApiKey(): { plainKey: string; hash: string } {
  const plainKey = randomBytes(24).toString("hex");
  return { plainKey, hash: hashDeviceApiKey(plainKey) };
}

export function hashDeviceApiKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}
