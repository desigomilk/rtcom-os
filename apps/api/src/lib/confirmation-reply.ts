const YES_WORDS = ["yes", "haan", "ha", "ok", "okay", "theek hai", "thik hai", "confirm"];
const NO_WORDS = ["no", "nahi", "nahin", "cancel", "reject", "mat karo"];

// A pending intent's confirmation message asks the customer to reply yes/no —
// this matches that short reply. Anything longer or unmatched is treated as a
// fresh message instead (falls through to intent parsing), not a confirmation,
// so we don't misfire on an unrelated message that happens to contain "ok".
export function matchConfirmationReply(body: string): "CONFIRM" | "REJECT" | null {
  const normalized = body.trim().toLowerCase();
  if (normalized.length > 20) return null;
  if (YES_WORDS.some((w) => normalized === w)) return "CONFIRM";
  if (NO_WORDS.some((w) => normalized === w)) return "REJECT";
  return null;
}
