import { test, expect } from 'bun:test';
import { buildServer } from '../src/server.ts';
import { database, closeDatabase } from '../src/database.ts';
process.env.MONGODB_DATABASE = `jam_full_test_${crypto.randomUUID().replaceAll('-', '')}`;
process.env.ADMIN_EMAILS = 'one@example.edu';
test('three real accounts post slots, match through syncs, accept and confirm', async () => {
 const app = buildServer();
 async function call(path: string, body: object = {}, cookie = '') {
  const r = await app.handle(new Request(`http://localhost:3000/api${path}`, { method:'POST', headers:{'Content-Type':'application/json',Origin:'http://localhost:3000',Cookie:cookie},body:JSON.stringify(body)}));
  const data = await r.json(); expect(r.status).toBe(200); return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]??''};
 }
 try {
  const date = new Date(); date.setDate(date.getDate()+3); date.setHours(12,0,0,0); const start=date.getTime();
  const cookies:string[]=[];
  for (const name of ['one','two','three']) {
   const a=await call('/auth/register',{email:`${name}@example.edu`,password:'long-test-password'}); cookies.push(a.cookie);
   await call('/profile/addInterest',{tag:'drawing'},a.cookie);
   await call('/requests/submit',{start,end:start+7200000,areas:'["Campus"]'},a.cookie);
  }
  await call('/admin/run',{},cookies[0]);
  for(const cookie of cookies){
   const inbox=await call('/invitations/mine',{},cookie); const rows=JSON.parse(inbox.data.inbox.invitations); expect(rows).toHaveLength(1);
   await call('/invitations/accept',{invitation:rows[0].invitation},cookie);
  }
  const events=await call('/events/mine',{},cookies[0]); expect(JSON.parse(events.data.calendar.events[0].details).status).toBe('CONFIRMED');
 } finally { await app.application.beginDrain(); await database().dropDatabase(); await closeDatabase(); }
},30000);
