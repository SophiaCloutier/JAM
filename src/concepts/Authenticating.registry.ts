import { registerConcept } from '@mit-sdg/sync-engine/assembly';
import { AuthenticatingConcept, InvalidCredentials, InvalidAccount, AccountTaken } from './Authenticating.ts';
import spec from '@design/concepts/Authenticating.md' with { type: 'text' };
export const authenticating = registerConcept({ class: AuthenticatingConcept, spec, refusals: { INVALID_CREDENTIALS: InvalidCredentials, INVALID_ACCOUNT: InvalidAccount, ACCOUNT_TAKEN: AccountTaken } });
