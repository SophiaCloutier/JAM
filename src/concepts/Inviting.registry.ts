import { registerConcept } from '@mit-sdg/sync-engine/assembly';
import { InvitingConcept, InvitationUnavailable, InvitationForbidden } from './Inviting.ts';
import spec from '@design/concepts/Inviting.md' with { type: 'text' };
export const inviting = registerConcept({
  class: InvitingConcept,
  spec,
  refusals: { INVITATION_UNAVAILABLE: InvitationUnavailable, INVITATION_FORBIDDEN: InvitationForbidden },
});
