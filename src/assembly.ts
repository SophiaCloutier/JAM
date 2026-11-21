import { assemble } from '@mit-sdg/sync-engine/assembly';
import { applicationConceptSet } from './concepts.ts';
import { composition as Sessions } from './compositions/Sessions.ts';
import { composition as Invitations } from './compositions/Invitations.ts';
import { composition as Profiles } from './compositions/Profiles.ts';
import { composition as Meetups } from './compositions/Meetups.ts';
export function assembleApplication() {
  return assemble({ conceptSet: applicationConceptSet, composition: { Sessions, Invitations, Profiles, Meetups } });
}
