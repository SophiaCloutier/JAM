import { leadDays } from '../shared/catalog.ts';
function hours(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number.`);
  return n * 3600000;
}
/** leadDays counts calendar days, not hours: on Thursday (any time of day) the earliest
 * requestable date is Saturday (any time of day). Matching for date D runs from the start
 * of D-1, after submissions for D have closed at the end of D-2. All days are Boston time. */
export const timing = { leadDays, duration: hours('EVENT_HOURS', 2), cutoff: hours('CUTOFF_HOURS', 8), response: 6 * 3600000 };
