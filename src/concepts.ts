import { conceptSet } from '@mit-sdg/sync-engine/assembly';
import { authenticating } from './concepts/Authenticating.registry.ts';
import { sessioning } from './concepts/Sessioning.registry.ts';
import { inviting } from './concepts/Inviting.registry.ts';
import { clock } from './concepts/Clock.registry.ts';
export const applicationConceptSet = conceptSet({ Authenticating: authenticating, Sessioning: sessioning, Inviting: inviting, Clock: clock });
export const { concepts } = applicationConceptSet;
