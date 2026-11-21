import { endpoint, receive, respond } from '@mit-sdg/sync-engine/boundary';
import { concepts } from '../concepts.ts';
import { input, text, sessionInput } from './validators.ts';
const { Authenticating, Sessioning } = concepts;
const credentials = input(['email', 'password'], v => text(v.email) && text(v.password, 128));
const Register = endpoint('/auth/register', ({ email, password, user, session, expiresAt }) => receive({ email, password })
  .then(Authenticating.register({ email, password }).responds({ user }))
  .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
  .then(respond({ user, session, expiresAt })), { input: { required: ['email', 'password'] }, validators: { input: credentials } });
const Login = endpoint('/auth/login', ({ email, password, user, session, expiresAt }) => receive({ email, password })
  .then(Authenticating.login({ email, password }).responds({ user }))
  .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
  .then(respond({ user, session, expiresAt })), { input: { required: ['email', 'password'] }, validators: { input: credentials } });
const Current = endpoint('/auth/current', ({ session, user }) => receive({ session })
  .then(Sessioning.current({ session }).responds({ user })).then(respond({ user })), { input: { required: ['session'] }, validators: { input: sessionInput } });
const Logout = endpoint('/auth/logout', ({ session, ended }) => receive({ session })
  .then(Sessioning.end({ session }).responds({ ended })).then(respond({ ended })), { input: { required: ['session'] }, validators: { input: sessionInput } });
export const composition = { Register, Login, Current, Logout };
