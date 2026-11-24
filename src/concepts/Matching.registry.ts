import { registerConcept } from '@mit-sdg/sync-engine/assembly';
import { MatchingConcept, InvalidSlot, SlotUnavailable } from './Matching.ts';
import spec from '@design/concepts/Matching.md' with { type: 'text' };
export const matching = registerConcept({
  class: MatchingConcept,
  spec,
  refusals: { INVALID_SLOT: InvalidSlot, SLOT_UNAVAILABLE: SlotUnavailable },
});
