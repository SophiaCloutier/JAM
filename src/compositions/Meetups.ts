import { endpoint, receive, respond } from '@mit-sdg/sync-engine/boundary';
import { each, former, form, reaction, when, where } from '@mit-sdg/sync-engine/language';
import { concepts } from '../concepts.ts';
import { input, text, sessionInput } from './validators.ts';
const { Matching, Characterizing, Inviting, EventGenerating, Sessioning, Clock } = concepts;
const MyRequests = former('my slots', ({ user }, { requests }) => where(Matching._mine({ user }).is({ requests })).form({ requests }));
const Mine = endpoint('/requests/mine', ({ session, user }) => receive({ session }).then(Sessioning.current({ session }).responds({ user }))
  .then(respond({ pool: MyRequests({ user }) })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const Submit = endpoint('/requests/submit', ({ session, user, interests, strikes, start, end, areas, request }) => receive({ session, start, end, areas })
  .then(Sessioning.current({ session }).responds({ user }))
  .then(where(Characterizing._get({ user }).is({ interests }), Inviting._strikes({ invitee: user }).is({ strikes }))
    .then(Matching.submit({ user, interests, strikes, start, end, areas }).responds({ request })).then(respond({ request }))),
  { input: { required: ['session', 'start', 'end', 'areas'] }, validators: { input: input(['session', 'start', 'end', 'areas'], v => {
    if (typeof v.start !== 'number' || typeof v.end !== 'number' || !text(v.areas, 200)) return false;
    try { const a = JSON.parse(v.areas); return Array.isArray(a) && a.length <= 3 && a.every(x => typeof x === 'string'); } catch { return false; }
  }) } });
const Withdraw = endpoint('/requests/withdraw', ({ session, user, request }) => receive({ session, request }).then(Sessioning.current({ session }).responds({ user }))
  .then(Matching.withdraw({ user, request })).then(respond({ request })), { input: { required: ['session', 'request'] }, validators: { input: input(['session', 'request'], v => text(v.request, 100)) } });
const StartMatching = reaction(() => when(Clock.hourly({}).responds({})).then(Matching.fillOpenGroups({})));
const FormGroups = reaction(({ limits }) => when(Matching.fillOpenGroups({}).responds({})).where(EventGenerating._limits({}).is({ limits })).then(Matching.formGroups({ limits })));
const GenerateForMatch = reaction(({ group, area, tag, start, end, size }) => when(Matching.formGroups({}).responds({})).where(Matching._drafts({}).is({ group, area, tag, start, end, size })).then(EventGenerating.generate({ group, area, tag, start, end, size })));
const RecoverDrafts = reaction(({ group, area, tag, start, end, size }) => when(Clock.recover({}).responds({})).where(Matching._drafts({}).is({ group, area, tag, start, end, size })).then(EventGenerating.generate({ group, area, tag, start, end, size })));
const ActivateGroup = reaction(({ group, event, capacity }) => when(EventGenerating.generate({ group }).responds({ generated: true, event, capacity })).then(Matching.activate({ group, event, capacity })));
const ReleaseFailedGroup = reaction(({ group }) => when(EventGenerating.generate({ group }).responds({ generated: false })).then(Matching.abandon({ group })));
const InviteParticipants = reaction(({ group, event, start, end, deadline, details, invitee, request }) => when(EventGenerating.generate({ group }).responds({ generated: true, event, start, end, deadline, details }))
  .where(Matching._members({ group }).is({ invitee, request })).then(Inviting.invite({ invitee, event, request, start, end, deadline, details })));
const DeliverBackfill = reaction(({ group, event, start, end, deadline, details, invitee, request }) => when(Matching.fillOpenGroups({}).responds({}))
  .where(EventGenerating._deliveries({}).is({ group, event, start, end, deadline, details }), Matching._members({ group }).is({ invitee, request })).then(Inviting.invite({ invitee, event, request, start, end,deadline, details })));
const RecoverDeliveries = reaction(({ group, event, start, end, deadline, details, invitee, request }) => when(Clock.recover({}).responds({}))
  .where(EventGenerating._deliveries({}).is({ group, event, start, end, deadline, details }), Matching._members({ group }).is({ invitee, request })).then(Inviting.invite({ invitee, event, request, start, end, deadline, details })));
const ReviewEvents = reaction(({ event, count }) => when(Clock.review({}).responds({})).where(EventGenerating._all({}).is({ event }), Inviting._count({ event }).is({ count })).then(EventGenerating.review({ event, count })));
const Confirm = reaction(({ event, count }) => when(Inviting.accept({}).responds({ event })).where(Inviting._count({ event }).is({ count })).then(EventGenerating.review({ event, count })));
const ReconsiderCancellation = reaction(({ event, count }) => when(Inviting.cancel({}).responds({ event })).where(Inviting._count({ event }).is({ count })).then(EventGenerating.review({ event, count })));
const SayNo = reaction(({ request }) => when(Inviting.decline({}).responds({ request })).then(Matching.reconcile({ request, status: 'DECLINED', active: false, reason: '' })));
const LateCancel = reaction(({ request }) => when(Inviting.cancel({}).responds({ request })).then(Matching.reconcile({ request, status: 'CANCELLED', active: false, reason: 'YOU_CANCELLED' })));
const CloseAtCutoff = reaction(({ group }) => when(EventGenerating.review({}).responds({ group, locked: true })).then(Matching.close({ group })));
const CancelInvitations = reaction(({ event }) => when(EventGenerating.review({}).responds({ event, status: 'CANCELLED' })).then(Inviting.closeEvent({ event, cancelled: true })));
const FinishInvitations = reaction(({ event }) => when(EventGenerating.review({}).responds({ event, status: 'DONE' })).then(Inviting.closeEvent({ event, cancelled: false })));
const AdminCancelled = reaction(({ event, group }) => when(EventGenerating.cancel({}).responds({ event, group })).then(Matching.close({ group })).then(Inviting.closeEvent({ event, cancelled: true })));
const ReconcileDecisions = reaction(({ request, status, active, reason }) => when(Clock.reconcile({}).responds({})).where(Inviting._all({}).is({ request, status, active, reason })).then(Matching.reconcile({ request, status, active, reason })));
const ReconcileClosedEvent = reaction(({ event, request, status, active, reason }) => when(Inviting.closeEvent({ event }).responds({})).where(Inviting._all({}).is({ event, request, status, active, reason })).then(Matching.reconcile({ request, status, active, reason })));
const ExpireWaiting = reaction(() => when(Clock.reconcile({}).responds({})).then(Matching.expireOpen({})));
const MyEvents = former('my event details', ({ user }, { event, details }) => form({ events: each(Inviting._forUser({ invitee: user }).is({ event }))
  .where(EventGenerating._get({ event }).is({ details })).form({ event, details }) }));
const Events = endpoint('/events/mine', ({ session, user }) => receive({ session }).then(Sessioning.current({ session }).responds({ user }))
  .then(respond({ calendar: MyEvents({ user }) })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const AdminEvents = former('admin event list', (_, { events }) => where(EventGenerating._admin({}).is({ events })).form({ events }));
const Admin = endpoint('/admin/events', ({ session, user }) => receive({ session }).then(Sessioning.authorize({ session }).responds({ user })).then(respond({ admin: AdminEvents({}) })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const Run = endpoint('/admin/run', ({ session, user, tick }) => receive({ session }).then(Sessioning.authorize({ session }).responds({ user })).then(Clock.hourly({}).responds({ tick })).then(respond({ tick })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const CancelEvent = endpoint('/admin/cancel', ({ session, user, event }) => receive({ session, event }).then(Sessioning.authorize({ session }).responds({ user })).then(EventGenerating.cancel({ event })).then(respond({ event })), { input: { required: ['session', 'event'] }, validators: { input: input(['session', 'event'], v => text(v.event, 100)) } });
export const composition = { MyRequests, Mine, Submit, Withdraw, StartMatching, FormGroups, GenerateForMatch, RecoverDrafts, ActivateGroup, ReleaseFailedGroup, InviteParticipants, DeliverBackfill, RecoverDeliveries, ReviewEvents, Confirm, ReconsiderCancellation, SayNo, LateCancel, CloseAtCutoff, CancelInvitations, FinishInvitations, AdminCancelled, ReconcileDecisions, ReconcileClosedEvent, ExpireWaiting, MyEvents, Events, AdminEvents, Admin, Run, CancelEvent };
