/** Demo data sized to the 12 sample cafés in src/venues.ts: about 60 users who already have requests,
 * grouped so a matching run exercises both Matching and EventGenerating (big groups, too few seats, seat sharing,
 * the daily cap, evening windows, no café open, no match). Everything goes through the real HTTP endpoints
 * (register, add interests, submit a request), so nothing is written to the database directly.
 *
 * Usage: bun run seed:requests          -> accounts + requests; then click "Run matching" as admin
 *        bun run seed:requests --run    -> also runs matching and prints where everyone ended up
 * Use a fresh MONGODB_DATABASE: a date is matched only once, so re-running after a run cannot add requests to it. */
import { buildServer } from '../src/server.ts';
import { closeDatabase } from '../src/database.ts';
import { addDays, bostonTime, leadDays, localDay } from '../shared/catalog.ts';
if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');

const PASSWORD = 'jam-demo-password',
  ADMIN = 'admin@example.edu';
const date = addDays(localDay(Date.now()), leadDays); // the earliest requestable date

/** A batch of people with the same request. `choice` '' means Surprise me. */
type Group = {
  name: string;
  count: number;
  interests: string[];
  choice: string;
  from: string;
  until: string;
  location: string;
  radius: number;
  expect: string;
};
const groups: Group[] = [
  {
    name: 'draw',
    count: 13,
    interests: ['drawing', 'painting'],
    choice: 'drawing',
    from: '13:00',
    until: '18:00',
    location: 'MIT campus',
    radius: 1,
    expect: 'One drawing cluster of 15 (with the two "surp" users); one event at the 15-seat campus café.',
  },
  {
    name: 'surp',
    count: 2,
    interests: ['pottery', 'drawing'],
    choice: '',
    from: '12:00',
    until: '18:00',
    location: 'MIT campus',
    radius: 1,
    expect: 'Surprise me: join the drawing cluster on an exact profile interest.',
  },
  {
    name: 'early',
    count: 8,
    interests: ['drawing'],
    choice: 'drawing',
    from: '07:00',
    until: '09:00',
    location: 'Back Bay',
    radius: 1,
    expect: 'Campus only, 07:00-09:00: only a 6-seat café is open, so 6 are invited and the 2 newest get NO_VENUE.',
  },
  {
    name: 'paint',
    count: 6,
    interests: ['painting'],
    choice: 'painting',
    from: '10:00',
    until: '13:00',
    location: 'Downtown Boston',
    radius: 1,
    expect: "Boston only; overlaps the photography group, so the two events may share a café's seats.",
  },
  {
    name: 'photo',
    count: 6,
    interests: ['photography'],
    choice: 'photography',
    from: '11:00',
    until: '14:00',
    location: 'Downtown Boston',
    radius: 1,
    expect: 'Boston only; overlaps the painting group.',
  },
  {
    name: 'origami',
    count: 4,
    interests: ['origami'],
    choice: 'origami',
    from: '14:00',
    until: '17:00',
    location: 'Harvard Square',
    radius: 1,
    expect: 'Cambridge only, same window as three other groups: seats and daily caps spread them over cafés and times.',
  },
  {
    name: 'collage',
    count: 4,
    interests: ['collage'],
    choice: 'collage',
    from: '14:00',
    until: '17:00',
    location: 'Harvard Square',
    radius: 1,
    expect: 'Cambridge only (see origami).',
  },
  {
    name: 'scrap',
    count: 4,
    interests: ['scrapbooking'],
    choice: 'scrapbooking',
    from: '14:00',
    until: '17:00',
    location: 'Harvard Square',
    radius: 1,
    expect: 'Cambridge only (see origami).',
  },
  {
    name: 'knit',
    count: 4,
    interests: ['knitting'],
    choice: 'knitting',
    from: '14:00',
    until: '17:00',
    location: 'Harvard Square',
    radius: 1,
    expect: 'Cambridge only (see origami).',
  },
  {
    name: 'guitar',
    count: 5,
    interests: ['guitar'],
    choice: 'guitar',
    from: '19:00',
    until: '22:00',
    location: 'Kendall Square',
    radius: 1,
    expect: 'Evening: the start time is chosen inside 19:00-22:00 at a café still open then.',
  },
  {
    name: 'dawn',
    count: 3,
    interests: ['pottery'],
    choice: 'pottery',
    from: '05:00',
    until: '07:00',
    location: 'MIT campus',
    radius: 1,
    expect: 'A cluster forms, but no café is open: all get NO_VENUE.',
  },
  {
    name: 'write',
    count: 2,
    interests: ['creative writing'],
    choice: 'creative writing',
    from: '10:00',
    until: '12:00',
    location: 'MIT campus',
    radius: 1,
    expect: 'Only two people share this interest: NO_MATCH.',
  },
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
const clock = (t: number) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(t);

try {
  const cookies = new Map<string, string>();
  let requested = 0;
  for (const g of groups) {
    for (let i = 1; i <= g.count; i++) {
      const name = `${g.name}${i}`;
      const cookie = await account(`${name}@example.edu`);
      cookies.set(name, cookie);
      for (const tag of g.interests) await call('/profile/addInterest', { tag }, cookie);
      const r = await call(
        '/requests/submit',
        {
          date,
          start: bostonTime(date, g.from),
          end: bostonTime(date, g.until),
          selected: g.choice,
          location: g.location,
          radius: g.radius,
        },
        cookie,
      );
      if (r.status === 200) requested++;
      else if (r.status !== 409) console.log(`${name}: refused ${JSON.stringify(r.data)}`);
    }
  }
  console.log(`${requested} new requests for ${date} (${cookies.size} users).`);

  const admin = await account(ADMIN);
  if (process.argv.includes('--run')) {
    const r = await call('/admin/run', {}, admin);
    if (r.status !== 200) throw new Error(`Matching not run (${r.status}). Is ADMIN_EMAILS=${ADMIN} set in .env?`);
    console.log('Matching ran.\n');
    for (const g of groups) {
      console.log(`== ${g.name} (${g.count}): ${g.expect}`);
      for (let i = 1; i <= g.count; i++) {
        const cookie = cookies.get(`${g.name}${i}`)!;
        const [req] = JSON.parse((await call('/requests/mine', {}, cookie)).data.pool.requests) as {
          status: string;
          reason: string;
        }[];
        const [inv] = JSON.parse((await call('/invitations/mine', {}, cookie)).data.inbox.invitations) as {
          start: number;
          end: number;
          details: string;
        }[];
        const where = inv ? `${JSON.parse(inv.details).venue}, ${clock(inv.start)}-${clock(inv.end)}` : '';
        const name = `${g.name}${i}`.padEnd(10);
        const reason = req.reason ? ` (${req.reason})` : '';
        console.log(`  ${name} ${req.status}${reason}${where ? `  ${where}` : ''}`);
      }
    }
  }
  console.log(`\nSign in as any seeded user (for example draw1@example.edu) or ${ADMIN}, password ${PASSWORD}.`);
  console.log(`Put ADMIN_EMAILS=${ADMIN} in .env to see the "Run matching" button.`);
} finally {
  await app.application.beginDrain();
  await closeDatabase();
}
