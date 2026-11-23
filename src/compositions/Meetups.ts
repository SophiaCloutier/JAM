import { endpoint, receive, respond } from '@mit-sdg/sync-engine/boundary';
import { each, former, form, reaction, when, where } from '@mit-sdg/sync-engine/language';
import { concepts } from '../concepts.ts';
import { input, text, sessionInput } from './validators.ts';
const { Matching, Characterizing, Inviting, EventGenerating, Sessioning } = concepts;

// ---- Requests -------------------------------------------------------------
const MyRequests = former('my requests', ({ user }, { requests }) => where(Matching._mine({ user }).is({ requests })).form({ requests }));
const Mine = endpoint('/requests/mine', ({ session, user }) => receive({ session }).then(Sessioning.current({ session }).responds({ user }))
  .then(respond({ pool: MyRequests({ user }) })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const requestFields = ['session', 'date', 'start', 'end', 'selected', 'location', 'radius'];
/** The profile interests are read here, at submit time, so later profile edits do not change an existing request. */
const Submit = endpoint('/requests/submit', ({ session, user, date, start, end, selected, location, radius, interests, request }) => receive({ session, date, start, end, selected, location, radius })
  .then(Sessioning.current({ session }).responds({ user }))
  .then(where(Characterizing._get({ user }).is({ interests }))
    .then(Matching.submit({ user, date, start, end, selected, interests, location, radius }).responds({ request })).then(respond({ request }))),
  { input: { required: requestFields }, validators: { input: input(requestFields, v =>
    text(v.date, 10) && typeof v.start === 'number' && typeof v.end === 'number' && typeof v.selected === 'string' && v.selected.length <= 40
    && text(v.location, 60) && typeof v.radius === 'number') } });
const Withdraw = endpoint('/requests/withdraw', ({ session, user, request }) => receive({ session, request }).then(Sessioning.current({ session }).responds({ user }))
  .then(Matching.withdraw({ user, request })).then(respond({ request })), { input: { required: ['session', 'request'] }, validators: { input: input(['session', 'request'], v => text(v.request, 100)) } });

// ---- Scheduled matching ---------------------------------------------------
// The host timer (and the admin Run endpoint) call Matching.openDue. Each due date then runs this chain once.
// Matching only scores similarity and availability; these reactions decide which interests each request offers:
//   Option 1 (an interest was chosen): exact clusters for it, then exact/related joins on it, then profile fallback.
//   Option 2 (Surprise me): joins on profile interests, then new clusters from profile interests.
const FormChosen = reaction(({ run, date, candidates, limits }) => when(Matching.openDue({}).responds({ run }))
  .where(Matching._opened({ run }).is({ date }), Matching._chosen({ date }).is({ candidates }), EventGenerating._limits({}).is({ limits }))
  .then(Matching.form({ date, stage: 'chosen', candidates, minScore: 1, limits })));
const JoinChosen = reaction(({ date, candidates, limits }) => when(Matching.form({ stage: 'chosen' }).responds({ date }))
  .where(Matching._chosen({ date }).is({ candidates }), EventGenerating._limits({}).is({ limits }))
  .then(Matching.assign({ date, stage: 'chosen', candidates, limits })));
const JoinProfile = reaction(({ date, candidates, limits }) => when(Matching.assign({ stage: 'chosen' }).responds({ date }))
  .where(Matching._profile({ date }).is({ candidates }), EventGenerating._limits({}).is({ limits }))
  .then(Matching.assign({ date, stage: 'profile', candidates, limits })));
const FormProfile = reaction(({ date, candidates, limits }) => when(Matching.assign({ stage: 'profile' }).responds({ date }))
  .where(Matching._profile({ date }).is({ candidates }), EventGenerating._limits({}).is({ limits }))
  .then(Matching.form({ date, stage: 'profile', candidates, minScore: 0.7, limits })));
const JoinLeftovers = reaction(({ date, candidates, limits }) => when(Matching.form({ stage: 'profile' }).responds({ date }))
  .where(Matching._profile({ date }).is({ candidates }), EventGenerating._limits({}).is({ limits }))
  .then(Matching.assign({ date, stage: 'leftover', candidates, limits })));
const Finish = reaction(({ date }) => when(Matching.assign({ stage: 'leftover' }).responds({ date })).then(Matching.finish({ date })));

// ---- Event planning and invitations ---------------------------------------
// Clusters cross as opaque JSON (tag, shared window, shared areas, members). EventGenerating plans venues, times and
// splits for a whole date once; it never sees similarity. Planning is idempotent per date, so recovery simply runs it again.
const GenerateForMatch = reaction(({ date, clusters }) => when(Matching.finish({}).responds({}))
  .where(Matching._planning({}).is({ date, clusters })).then(EventGenerating.plan({ date, clusters })));
const RecoverDrafts = reaction(({ date, clusters }) => when(Matching.openDue({}).responds({}))
  .where(Matching._planning({}).is({ date, clusters })).then(EventGenerating.plan({ date, clusters })));
const InviteParticipants = reaction(({ plan, event, start, end, deadline, details, invitee, request }) => when(EventGenerating.plan({}).responds({ plan }))
  .where(EventGenerating._planned({ plan }).is({ event, start, end, deadline, details }), EventGenerating._members({ event }).is({ invitee, request }))
  .then(Inviting.invite({ invitee, event, request, start, end, deadline, details })));
// Status only: clusters with a seated member become generated, others failed; unseated members become unmatched (NO_VENUE).
const SettlePlan = reaction(({ date, plan, placed }) => when(EventGenerating.plan({ date }).responds({ plan }))
  .where(EventGenerating._placed({ plan }).is({ placed })).then(Matching.settle({ date, placed })));
const RecoverDeliveries = reaction(({ event, start, end, deadline, details, invitee, request }) => when(Matching.openDue({}).responds({}))
  .where(EventGenerating._deliveries({}).is({ event, start, end, deadline, details }), EventGenerating._members({ event }).is({ invitee, request }))
  .then(Inviting.invite({ invitee, event, request, start, end, deadline, details })));

// ---- Responses and event lifecycle ----------------------------------------
const Confirm = reaction(({ event, count }) => when(Inviting.accept({}).responds({ event })).where(Inviting._count({ event }).is({ count })).then(EventGenerating.review({ event, count })));
const ReconsiderCancellation = reaction(({ event, count }) => when(Inviting.cancel({}).responds({ event })).where(Inviting._count({ event }).is({ count })).then(EventGenerating.review({ event, count })));
const SayNo = reaction(({ request }) => when(Inviting.decline({}).responds({ request })).then(Matching.reconcile({ request, status: 'DECLINED', active: false, reason: '' })));
const LateCancel = reaction(({ request }) => when(Inviting.cancel({}).responds({ request })).then(Matching.reconcile({ request, status: 'CANCELLED', active: false, reason: 'YOU_CANCELLED' })));
// Several events may share a group (cluster). Matching.close only sets the cluster's status marker; it never touches
// requests or other events, so closing for one event cannot affect a sibling event or its members.
const CloseAtCutoff = reaction(({ group }) => when(EventGenerating.review({}).responds({ group, locked: true })).then(Matching.close({ cluster: group })));
const CancelInvitations = reaction(({ event }) => when(EventGenerating.review({}).responds({ event, status: 'CANCELLED' })).then(Inviting.closeEvent({ event, cancelled: true })));
const FinishInvitations = reaction(({ event }) => when(EventGenerating.review({}).responds({ event, status: 'DONE' })).then(Inviting.closeEvent({ event, cancelled: false })));
// The host timer calls EventGenerating.reviewDue; these react to the events whose status it changed.
const CancelDue = reaction(({ review, event }) => when(EventGenerating.reviewDue({}).responds({ review }))
  .where(EventGenerating._reviewed({ review }).is({ event, status: 'CANCELLED' })).then(Inviting.closeEvent({ event, cancelled: true })));
const FinishDue = reaction(({ review, event }) => when(EventGenerating.reviewDue({}).responds({ review }))
  .where(EventGenerating._reviewed({ review }).is({ event, status: 'DONE' })).then(Inviting.closeEvent({ event, cancelled: false })));
const CloseReviewed = reaction(({ review, group }) => when(EventGenerating.reviewDue({}).responds({ review }))
  .where(EventGenerating._reviewed({ review }).is({ group })).then(Matching.close({ cluster: group })));
const AdminCancelled = reaction(({ event, group }) => when(EventGenerating.cancel({}).responds({ event, group })).then(Matching.close({ cluster: group })).then(Inviting.closeEvent({ event, cancelled: true })));
const ReconcileClosedEvent = reaction(({ event, request, status, active, reason }) => when(Inviting.closeEvent({ event }).responds({})).where(Inviting._all({}).is({ event, request, status, active, reason })).then(Matching.reconcile({ request, status, active, reason })));

// ---- Reads and admin ------------------------------------------------------
const MyEvents = former('my event details', ({ user }, { event, details }) => form({ events: each(Inviting._forUser({ invitee: user }).is({ event }))
  .where(EventGenerating._get({ event }).is({ details })).form({ event, details }) }));
const Events = endpoint('/events/mine', ({ session, user }) => receive({ session }).then(Sessioning.current({ session }).responds({ user }))
  .then(respond({ calendar: MyEvents({ user }) })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const AdminEvents = former('admin event list', (_, { events }) => where(EventGenerating._admin({}).is({ events })).form({ events }));
const Admin = endpoint('/admin/events', ({ session, user }) => receive({ session }).then(Sessioning.authorize({ session }).responds({ user })).then(respond({ admin: AdminEvents({}) })), { input: { required: ['session'] }, validators: { input: sessionInput } });
/** Admin demo control: run matching now, treating dates up to the earliest requestable date as due. */
const Run = endpoint('/admin/run', ({ session, user, run }) => receive({ session }).then(Sessioning.authorize({ session }).responds({ user })).then(Matching.openDue({ force: true }).responds({ run })).then(respond({ run })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const CancelEvent = endpoint('/admin/cancel', ({ session, user, event }) => receive({ session, event }).then(Sessioning.authorize({ session }).responds({ user })).then(EventGenerating.cancel({ event })).then(respond({ event })), { input: { required: ['session', 'event'] }, validators: { input: input(['session', 'event'], v => text(v.event, 100)) } });

export const composition = { MyRequests, Mine, Submit, Withdraw, FormChosen, JoinChosen, JoinProfile, FormProfile, JoinLeftovers, Finish, GenerateForMatch, RecoverDrafts, InviteParticipants, SettlePlan, RecoverDeliveries, Confirm, ReconsiderCancellation, SayNo, LateCancel, CloseAtCutoff, CancelInvitations, FinishInvitations, CancelDue, FinishDue, CloseReviewed, AdminCancelled, ReconcileClosedEvent, MyEvents, Events, AdminEvents, Admin, Run, CancelEvent };
