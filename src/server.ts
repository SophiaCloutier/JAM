import { createGateway } from '@mit-sdg/sync-engine/boundary';
import { createHttpHandler } from '@mit-sdg/sync-engine-http/handler';
import { assembleApplication } from './assembly.ts';
import { policy } from './edge.ts';

export function buildServer() {
  const application = assembleApplication();
  const gateway = createGateway({ application });
  const http = createHttpHandler({ application, gateway, policy });
  // One alpha process owns writes. Hold admission until reactions settle too.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work); queue = next.catch(() => {}); return next;
  }
  return { application,
    handle: (request: Request) => serial(async () => {
      if (new URL(request.url).pathname.startsWith('/api/internal/')) return new Response('Not found', { status: 404 });
      const response = await http(request); await application.whenIdle(); return response;
    }),
    tick: () => serial(async () => { await application.concepts.Clock.tick({}); await application.whenIdle(); }),
  };
}
