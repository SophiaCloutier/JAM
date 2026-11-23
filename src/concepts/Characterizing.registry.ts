import { registerConcept } from '@mit-sdg/sync-engine/assembly';
import { CharacterizingConcept, InvalidInterest, ProfileExists, ProfileNotFound } from './Characterizing.ts';
import spec from '@design/concepts/Characterizing.md' with { type: 'text' };
export const characterizing = registerConcept({ class: CharacterizingConcept, spec, refusals: { INVALID_INTEREST: InvalidInterest, PROFILE_EXISTS: ProfileExists, PROFILE_NOT_FOUND: ProfileNotFound } });
