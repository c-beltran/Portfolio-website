/** No JSON imports here, so Playwright tests can import it directly. */
export const CAREER_START = new Date('2019-07-01');

/** Whole years between two dates, floored (UTC, so the result never depends on the timezone). */
export function yearsSince(start: Date, now: Date): number {
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    now.getUTCMonth() < start.getUTCMonth() ||
    (now.getUTCMonth() === start.getUTCMonth() && now.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return years;
}
