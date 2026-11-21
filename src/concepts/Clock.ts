/** The host supplies ticks; tests can supply a deterministic time. */
export class ClockConcept {
  async tick(_: Record<string, never>) { return { tick: crypto.randomUUID() }; }
  async review(_: Record<string, never>) { return { tick: crypto.randomUUID() }; }
  async reconcile(_: Record<string, never>) { return { tick: crypto.randomUUID() }; }
  async recover(_: Record<string, never>) { return { tick: crypto.randomUUID() }; }
  async hourly(_: Record<string, never>) { return { tick: crypto.randomUUID() }; }
}
