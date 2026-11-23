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
  /** Scheduled work. Each concept owns its own time rules; the host only asks them to apply them.
   * Matching opens due dates (reactions run the matching chain, generation and invitations),
   * then EventGenerating settles events past their cutoff or end. */
  async function poke() {
    await application.concepts.Matching.openDue({ force: false }); await application.whenIdle();
    await application.concepts.EventGenerating.reviewDue({}); await application.whenIdle();
  }
  return { application,
    handle: (request: Request) => serial(async () => {
      if (new URL(request.url).pathname.startsWith('/api/internal/')) return new Response('Not found', { status: 404 });
      const response = await http(request); await application.whenIdle(); return response;
    }),
    poke: () => serial(poke),
  };
}
