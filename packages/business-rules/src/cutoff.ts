import { startOfUtcDay } from "./dates";

// Desigo's ops rule: "Sham 6:30 baje tak ka change agli subah lagta hai" —
// a change requested by 6:30 PM applies from the next morning's delivery.
// Packaging for the very next morning is locked in right after the cutoff, so
// a request made *after* 6:30 PM can only take effect the morning after that.
//
// The cutoff is a wall-clock time in the business's one operating timezone
// (Asia/Kolkata, a fixed UTC+5:30 with no DST) — computed explicitly via the
// offset below rather than the server process's local timezone, so this gives
// the same answer whether the API runs on a laptop in IST or a cloud host in UTC.
const IST_OFFSET_MINUTES = 330;
const CUTOFF_HOUR = 18;
const CUTOFF_MINUTE = 30;

function shiftToIstWallClock(instant: Date): Date {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
}

export function computeEffectiveDate(requestedAt: Date): Date {
  const ist = shiftToIstWallClock(requestedAt);
  const isOnOrBeforeCutoff =
    ist.getUTCHours() < CUTOFF_HOUR ||
    (ist.getUTCHours() === CUTOFF_HOUR && ist.getUTCMinutes() <= CUTOFF_MINUTE);
  const daysToAdd = isOnOrBeforeCutoff ? 1 : 2;

  // `ist` is a UTC instant artificially shifted by the IST offset, so its
  // UTC year/month/day *is* the IST calendar date — startOfUtcDay reads that
  // off correctly without a second, compounding shift.
  const effective = startOfUtcDay(ist);
  effective.setUTCDate(effective.getUTCDate() + daysToAdd);
  return effective;
}

export function isOnOrAfterEffectiveDate(
  date: Date,
  requestedAt: Date,
): boolean {
  return (
    startOfUtcDay(date).getTime() >= computeEffectiveDate(requestedAt).getTime()
  );
}
