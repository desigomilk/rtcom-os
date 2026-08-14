import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

// Refresh tokens are opaque (not JWTs): "<userId>.<random>". The random part is
// hashed with bcrypt and stored on the user row (User.refreshTokenHash), so a
// leaked DB dump alone can't be replayed as a valid refresh token.
export async function issueRefreshToken(
  userId: string,
): Promise<{ token: string; hash: string }> {
  const random = randomBytes(32).toString("hex");
  const token = `${userId}.${random}`;
  const hash = await bcrypt.hash(random, 10);
  return { token, hash };
}

export function parseRefreshToken(
  token: string,
): { userId: string; random: string } | null {
  const separatorIndex = token.indexOf(".");
  if (separatorIndex === -1) return null;
  const userId = token.slice(0, separatorIndex);
  const random = token.slice(separatorIndex + 1);
  if (!userId || !random) return null;
  return { userId, random };
}

export async function verifyRefreshToken(
  token: string,
  storedHash: string,
): Promise<boolean> {
  const parsed = parseRefreshToken(token);
  if (!parsed) return false;
  return bcrypt.compare(parsed.random, storedHash);
}
