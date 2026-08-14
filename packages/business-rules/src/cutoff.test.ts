import { describe, expect, it } from "vitest";
import { computeEffectiveDate, isOnOrAfterEffectiveDate } from "./cutoff";

describe("computeEffectiveDate", () => {
  it("requested before 6:30 PM takes effect the next day", () => {
    const requestedAt = new Date("2026-03-10T14:00:00");
    expect(computeEffectiveDate(requestedAt).toISOString().slice(0, 10)).toBe(
      "2026-03-11",
    );
  });

  it("requested exactly at 6:30 PM still takes effect the next day", () => {
    const requestedAt = new Date("2026-03-10T18:30:00");
    expect(computeEffectiveDate(requestedAt).toISOString().slice(0, 10)).toBe(
      "2026-03-11",
    );
  });

  it("requested one minute after 6:30 PM takes effect the day after next", () => {
    const requestedAt = new Date("2026-03-10T18:31:00");
    expect(computeEffectiveDate(requestedAt).toISOString().slice(0, 10)).toBe(
      "2026-03-12",
    );
  });

  it("requested late at night takes effect the day after next", () => {
    const requestedAt = new Date("2026-03-10T23:59:00");
    expect(computeEffectiveDate(requestedAt).toISOString().slice(0, 10)).toBe(
      "2026-03-12",
    );
  });
});

describe("isOnOrAfterEffectiveDate", () => {
  it("rejects a date before the effective date", () => {
    const requestedAt = new Date("2026-03-10T20:00:00"); // effective 2026-03-12
    expect(isOnOrAfterEffectiveDate(new Date("2026-03-11"), requestedAt)).toBe(
      false,
    );
  });

  it("accepts a date on or after the effective date", () => {
    const requestedAt = new Date("2026-03-10T20:00:00"); // effective 2026-03-12
    expect(isOnOrAfterEffectiveDate(new Date("2026-03-12"), requestedAt)).toBe(
      true,
    );
    expect(isOnOrAfterEffectiveDate(new Date("2026-03-15"), requestedAt)).toBe(
      true,
    );
  });
});
