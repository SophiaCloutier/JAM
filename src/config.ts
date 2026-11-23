import { leadDays } from '../shared/catalog.ts';
function hours(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number.`);
  return n * 3600000;
}
function minutes(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n <= 0 || 1440 % n !== 0) throw new Error(`${name} must be a whole number of minutes that divides a day.`);
  return n;
}
/** leadDays counts calendar days, not hours: on Thursday (any time of day) the earliest
 * requestable date is Saturday (any time of day). Matching for date D runs from the start
 * of D-1, after submissions for D have closed at the end of D-2. All days are Boston time. */
export const timing = { leadDays, duration: hours('EVENT_HOURS', 2), cutoff: hours('CUTOFF_HOURS', 8), response: 6 * 3600000 };
/** Every numeric rule of the event planner (src/event-planner.ts), in one place.
 * Start times lie on a grid of `gridMinutes` from Boston midnight. `seed` only breaks ties between equally good
 * sessions so choices spread across venues; changing it never changes how many people are placed. */
export const START_GRID_MINUTES = minutes('START_GRID_MINUTES', 30);
export const planning = { gridMinutes: START_GRID_MINUTES, seed: 'jam-planner-v1', minSize: 3, maxSize: 15 };
