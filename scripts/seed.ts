import { AuthenticatingConcept, AccountTaken } from '../src/concepts/Authenticating.ts';
import { CharacterizingConcept, ProfileExists } from '../src/concepts/Characterizing.ts';
import { InvitingConcept } from '../src/concepts/Inviting.ts';
import { closeDatabase } from '../src/database.ts';
if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');
const accounts = new AuthenticatingConcept(), inviting = new InvitingConcept(), characterizing = new CharacterizingConcept();
const start = Date.now() + 48 * 3600000, end = start + 2 * 3600000;
for (const name of ['percy', 'riley', 'alex']) {
  const user = `${name}@example.edu`;
  try { await accounts.register({ email: user, password: 'jam-demo-password' }); }
  catch (e) { if (!(e instanceof AccountTaken)) throw e; }
  try { await characterizing.create({ user }); }
  catch (e) { if (!(e instanceof ProfileExists)) throw e; }
  await inviting.invite({ invitee: user, event: 'demo-scrapbooking', request: `demo-${name}`, start, end,
    deadline: Date.now() + 6 * 3600000,
    details: JSON.stringify({ title: 'A little paper, a little company', description: 'Bring a notebook, a few clippings, and something to draw with. We’ll make pages and see what happens. This is a demo event, not a venue booking.', inviteBlurb: 'An easy afternoon of scrapbooking with other curious beginners.', venue: 'Campus common room (demo)', area: 'Campus' }),
  });
}
console.log('Demo ready. Sign in as percy@example.edu, riley@example.edu, or alex@example.edu with jam-demo-password.');
await closeDatabase();
