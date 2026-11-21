import { httpPolicy } from '@mit-sdg/sync-engine-http/policy';
export const policy = httpPolicy({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000', basePath: '/api',
  limits: { requestBodyBytes: 32768 },
  publicErrors: { INVALID_INTEREST: 'INVALID_REQUEST', INVALID_SLOT: 'INVALID_REQUEST', SLOT_UNAVAILABLE: 'CONFLICT', EVENT_UNAVAILABLE: 'CONFLICT', INVALID_ACCOUNT: 'INVALID_REQUEST', ACCOUNT_TAKEN: 'CONFLICT', INVALID_CREDENTIALS: 'UNAUTHORIZED', UNKNOWN_SESSION: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN', INVITATION_UNAVAILABLE: 'CONFLICT', INVITATION_FORBIDDEN: 'FORBIDDEN' },
  cookies: { session: { name: 'jam-session', input: 'session', issue: [
    { path: '/auth/register', value: 'session', expires: 'expiresAt' },
    { path: '/auth/login', value: 'session', expires: 'expiresAt' },
  ], clear: ['/auth/logout'] } },
});

