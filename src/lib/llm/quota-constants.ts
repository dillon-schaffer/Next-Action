/**
 * Shared daily cap for AI-generated suggestions. Used by the DB-backed quota
 * (signed-in users, see generated-quota.ts) and the browser-local quota
 * (guests, see @/lib/guest/store) so both enforce the same limit.
 */
export const GENERATED_SUGGESTION_DAILY_CAP = 5;

/** Start of day in UTC, for consistent "per calendar day" boundaries. */
export function utcDayStart(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}
