import { assemble } from '@mit-sdg/sync-engine/assembly';
import { applicationConceptSet } from './concepts.ts';
import { composition as Sessions } from './compositions/Sessions.ts';
import { composition as Invitations } from './compositions/Invitations.ts';
export function assembleApplication() {
  return assemble({ conceptSet: applicationConceptSet, composition: { Sessions, Invitations } });
}
