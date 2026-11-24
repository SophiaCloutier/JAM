/** Demo data for the matching flow. Everything goes through the real HTTP endpoints and reactions
 * (register, add interests, submit a request), so nothing is written to the database directly.
 * Usage: bun run seed:matching            -> accounts + requests; then click "Run matching" as admin
 *        bun run seed:matching --run      -> also runs matching immediately as the admin
 * Safe to re-run: existing accounts sign in, and an existing open request is left alone. */
import { buildServer } from '../src/server.ts';
import { closeDatabase } from '../src/database.ts';
import { addDays, bostonTime, leadDays, localDay } from '../shared/catalog.ts';
if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');

const PASSWORD = 'jam-demo-password',
  ADMIN = 'admin@example.edu';
const date = addDays(localDay(Date.now()), leadDays); // the earliest requestable date
/** Who to create. `choice` is the chosen interest; '' means Surprise me. Expected results are in the comments. */
const people = [
  // Three people choose drawing: an exact drawing group forms.
  { name: 'ava', interests: ['drawing', 'photography'], choice: 'drawing' },
  { name: 'ben', interests: ['drawing', 'pottery'], choice: 'drawing' },
  { name: 'cara', interests: ['drawing', 'painting'], choice: 'drawing' },
  // Chose painting, which has no group of its own: joins drawing through the related score (0.7).
  { name: 'dev', interests: ['painting'], choice: 'painting' },
  // Surprise me with different music interests: a new group forms from related profile interests.
  { name: 'eli', interests: ['guitar'], choice: '' },
  { name: 'fay', interests: ['drums'], choice: '' },
  { name: 'gus', interests: ['singing', 'creative writing'], choice: '' },
  // Nothing related to anyone else: stays unmatched and is asked to choose another date.
  { name: 'hal', interests: ['pottery'], choice: 'pottery' },
];

const app = buildServer();
async function call(path: string, body: object = {}, cookie = '') {
  const r = await app.handle(
    new Request(`http://localhost:3000/api${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000',
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: r.status,
    data: await r.json().catch(() => ({})),
    cookie: r.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}
async function account(email: string) {
  const created = await call('/auth/register', { email, password: PASSWORD });
  const r = created.status === 200 ? created : await call('/auth/login', { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`Could not sign in ${email}: ${JSON.stringify(r.data)}`);
  return r.cookie;
}

try {
  for (const p of people) {
    const cookie = await account(`${p.name}@example.edu`);
    for (const tag of p.interests) await call('/profile/addInterest', { tag }, cookie);
    const r = await call(
      '/requests/submit',
      {
        date,
        start: bostonTime(date, '12:00'),
        end: bostonTime(date, '16:00'),
        selected: p.choice,
        location: 'MIT campus',
        radius: 3,
      },
      cookie,
    );
    let outcome = `refused: ${JSON.stringify(r.data)}`;
    if (r.status === 200) outcome = 'requested';
    else if (r.status === 409) outcome = 'already has an open request (or the date was matched)';
    console.log(`${p.name.padEnd(5)} ${outcome}`);
  }
  const admin = await account(ADMIN);
  if (process.argv.includes('--run')) {
    const r = await call('/admin/run', {}, admin);
    console.log(
      r.status === 200 ? 'Matching ran.' : `Matching not run (${r.status}). Is ADMIN_EMAILS=${ADMIN} set in .env?`,
    );
  }
  console.log(`\nRequests are for ${date}, 12:00-16:00 Boston time, within 3 mi of MIT campus.`);
  console.log(
    `Sign in as any of ${people.map(p => p.name).join(', ')} (@example.edu) or ${ADMIN}, password ${PASSWORD}.`,
  );
  console.log(`Put ADMIN_EMAILS=${ADMIN} in .env to see the "Run matching" button.`);
} finally {
  await app.application.beginDrain();
  await closeDatabase();
}
