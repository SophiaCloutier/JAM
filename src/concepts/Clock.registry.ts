import { registerConcept } from '@mit-sdg/sync-engine/assembly';
import { ClockConcept } from './Clock.ts';
import spec from '@design/concepts/Clock.md' with { type: 'text' };
export const clock = registerConcept({ class: ClockConcept, spec, refusals: {  } });
