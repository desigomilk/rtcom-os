// All calendar-date handling here works in UTC-normalized terms, never the
// server process's local timezone. A Postgres `@db.Date` column stores a bare
// calendar date with no timezone; JS's own `new Date("YYYY-MM-DD")` parsing
// already treats date-only strings as UTC midnight, so staying in UTC (via
// getUTC*/setUTC*) keeps that meaning intact end to end. Mixing in local-time
// getters/setters on a machine whose timezone isn't UTC (e.g. IST, UTC+5:30)
// silently shifts dates by a day — that bug is exactly why this file is UTC-only.
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function enumerateDates(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = startOfUtcDay(from);
  const end = startOfUtcDay(to);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
