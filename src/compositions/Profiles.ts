import { endpoint, receive, respond } from '@mit-sdg/sync-engine/boundary';
import { former, where, reaction, when } from '@mit-sdg/sync-engine/language';
import { concepts } from '../concepts.ts';
import { input, text, sessionInput } from './validators.ts';
const { Characterizing, Authenticating, Sessioning } = concepts;
const CreateProfile = reaction(({ user }) =>
  when(Authenticating.register({}).responds({ user })).then(Characterizing.create({ user })),
);
const MyProfile = former('my interests', ({ user }, { interests }) =>
  where(Characterizing._get({ user }).is({ interests })).form({ interests }),
);
const Profile = endpoint(
  '/profile/mine',
  ({ session, user }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(respond({ profile: MyProfile({ user }) })),
  { input: { required: ['session'] }, validators: { input: sessionInput } },
);
const tagInput = {
  input: { required: ['session', 'tag'] },
  validators: { input: input(['session', 'tag'], v => text(v.tag, 40)) },
};
const AddInterest = endpoint(
  '/profile/addInterest',
  ({ session, user, tag, normalized }) =>
    receive({ session, tag })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Characterizing.addInterest({ user, tag }).responds({ tag: normalized }))
      .then(respond({ tag: normalized })),
  tagInput,
);
const RemoveInterest = endpoint(
  '/profile/removeInterest',
  ({ session, user, tag }) =>
    receive({ session, tag })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Characterizing.removeInterest({ user, tag }))
      .then(respond({ tag })),
  tagInput,
);
export const composition = { CreateProfile, MyProfile, Profile, AddInterest, RemoveInterest };
