/** The host supplies ticks; tests can supply a deterministic time. */
export class ClockConcept {
  async tick(_: Record<string, never>) { return { tick: crypto.randomUUID() }; }
}
