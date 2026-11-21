function hours(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number.`);
  return n * 3600000;
}
export const timing = { lead: hours('LEAD_HOURS', 24), duration: hours('EVENT_HOURS', 2), cutoff: hours('CUTOFF_HOURS', 8), response: 6 * 3600000 };
if (timing.lead < timing.cutoff + timing.response) throw new Error('LEAD_HOURS must allow the cutoff plus the six-hour response window.');
