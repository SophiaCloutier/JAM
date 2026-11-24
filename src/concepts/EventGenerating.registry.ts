import { registerConcept } from '@mit-sdg/sync-engine/assembly';
import { EventGeneratingConcept, EventUnavailable } from './EventGenerating.ts';
import spec from '@design/concepts/EventGenerating.md' with { type: 'text' };
export const eventgenerating = registerConcept({
  class: EventGeneratingConcept,
  spec,
  refusals: { EVENT_UNAVAILABLE: EventUnavailable },
});
