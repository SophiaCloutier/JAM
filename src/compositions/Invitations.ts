import { endpoint, receive, respond } from '@mit-sdg/sync-engine/boundary';
import { reaction, when, former, form, where } from '@mit-sdg/sync-engine/language';
import { concepts } from '../concepts.ts';
import { input, text, sessionInput } from './validators.ts';
const { Inviting, Sessioning, Clock } = concepts;
const MyInbox = former('my invitations', ({ user }, { invitations, strikes }) =>
  where(Inviting._mine({ invitee: user }).is({ invitations, strikes })).form({ invitations, strikes }));
const choice = { input: { required: ['session', 'invitation'] }, validators: { input: input(['session', 'invitation'], v => text(v.invitation, 100)) } };
const Inbox = endpoint('/invitations/mine', ({ session, user, invitations, strikes }) => receive({ session })
  .then(Sessioning.current({ session }).responds({ user }))
  .then(respond({ inbox: MyInbox({ user }) })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const Accept = endpoint('/invitations/accept', ({ session, user, invitation, event }) => receive({ session, invitation })
  .then(Sessioning.current({ session }).responds({ user }))
  .then(Inviting.accept({ invitation, invitee: user }).responds({ event })).then(respond({ event })), choice);
const Decline = endpoint('/invitations/decline', ({ session, user, invitation, event }) => receive({ session, invitation })
  .then(Sessioning.current({ session }).responds({ user }))
  .then(Inviting.decline({ invitation, invitee: user }).responds({ event })).then(respond({ event })), choice);
const Cancel = endpoint('/invitations/cancel', ({ session, user, invitation, event }) => receive({ session, invitation })
  .then(Sessioning.current({ session }).responds({ user }))
  .then(Inviting.cancel({ invitation, invitee: user }).responds({ event })).then(respond({ event })), choice);
const ExpireOverdue = reaction(({ invitation }) => when(Clock.tick({}).responds({}))
  .where(Inviting._overdue({}).is({ invitation })).then(Inviting.expire({ invitation })));
export const composition = { MyInbox, Inbox, Accept, Decline, Cancel, ExpireOverdue };
