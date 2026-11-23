import { database, closeDatabase } from './database.ts';
import { buildServer } from './server.ts';
if (process.env.NODE_ENV === 'production' && (!process.env.MONGODB_URI || !process.env.PUBLIC_ORIGIN))
  throw new Error('Production requires MONGODB_URI and PUBLIC_ORIGIN in the environment.');
await database().command({ ping: 1 });
const app = buildServer();
// Scheduled work runs at startup and every five minutes. Repeats are harmless: each date is matched once.
await app.poke();
const interval = setInterval(() => void app.poke().catch(e => console.error('Scheduled work failed:', e)), 5 * 60000);
const server = Bun.serve({ hostname: '0.0.0.0', port: Number(process.env.PORT ?? 3000), maxRequestBodySize: 32768,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/health') {
      try { await database().command({ ping: 1 }); return Response.json({ ok: true }); }
      catch { return Response.json({ ok: false }, { status: 503 }); }
    }
    if (path.startsWith('/api/')) return app.handle(request);
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (path !== '/' && !/^\/assets\/[A-Za-z0-9._-]+$/.test(path)) return new Response('Not found', { status: 404 });
    const file = Bun.file(new URL(`../web-dist${path === '/' ? '/index.html' : path}`, import.meta.url));
    return await file.exists() ? new Response(file) : new Response('Run bun run build first.', { status: 503 });
  },
});
console.log(`JAM is running at ${server.url}`);
async function stop() { clearInterval(interval); await server.stop(); await app.application.beginDrain(); await closeDatabase(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
