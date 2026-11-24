import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { eventCopy } from '../src/event-copy.ts';

/*
 * Testing strategy (fetch is mocked; no network)
 *
 * eventCopy(tag)
 *   partition on configuration:
 *     - no API key or model: template, fetch never called
 *     - key and model set: one call to Chat Completions
 *   partition on the response:
 *     - 200 with valid copy: model copy is returned
 *     - HTTP error (500)
 *     - timeout (the request is aborted)
 *     - content that is not JSON
 *     - a field over its length limit
 *   every failing response falls back to the template
 */

type Copy = { title: string; description: string; inviteBlurb: string };

const realFetch = globalThis.fetch;
const savedEnv = { key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL };

/** The template copy for a tag, read with the model switched off. */
async function template(tag: string): Promise<Copy> {
  const key = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    return await eventCopy(tag);
  } finally {
    process.env.OPENAI_API_KEY = key;
  }
}

/** A Chat Completions response whose message content is `content`. */
function completion(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Replaces fetch with a mock that runs `respond` for each call. */
function mockFetch(respond: (url: string, init: RequestInit) => Promise<Response>) {
  const fake = mock(respond);
  globalThis.fetch = fake as unknown as typeof fetch;
  return fake;
}

const goodCopy: Copy = {
  title: 'Sketch together',
  description: 'Bring a pencil and some paper.',
  inviteBlurb: 'A friendly drawing session.',
};

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'test-model';
});
afterEach(() => {
  globalThis.fetch = realFetch;
  mock.restore();
  if (savedEnv.key === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedEnv.key;
  if (savedEnv.model === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = savedEnv.model;
});

describe('configuration', () => {
  // covers: no API key or model
  test('without an API key and model the template is used and nothing is fetched', async () => {
    const fake = mockFetch(async () => completion(JSON.stringify(goodCopy)));
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;

    const copy = await eventCopy('drawing');

    expect(fake).not.toHaveBeenCalled();
    expect(copy.title).toBe('Make time for drawing');
  });
});

describe('successful response', () => {
  // covers: key and model set; 200 with valid copy
  test('valid copy from the model is returned, and the request carries the tag only as data', async () => {
    const fake = mockFetch(async () => completion(JSON.stringify(goodCopy)));

    expect(await eventCopy('drawing')).toEqual(goodCopy);

    expect(fake).toHaveBeenCalledTimes(1);
    const [url, init] = fake.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('test-model');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: JSON.stringify({ interest: 'drawing' }) });
  });
});

describe('failures fall back to the template', () => {
  // covers: HTTP error (500)
  test('a 500 response', async () => {
    mockFetch(async () => completion(JSON.stringify(goodCopy), 500));
    expect(await eventCopy('drawing')).toEqual(await template('drawing'));
  });

  // covers: timeout
  test('a request that times out', async () => {
    // eventCopy asks for an 8-second timeout; shorten that timer so the test does not wait 8 seconds.
    const timeout = spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), 10);
      return controller.signal;
    });
    // Like a real fetch, reject once the signal aborts, and otherwise never answer.
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );

    expect(await eventCopy('drawing')).toEqual(await template('drawing'));
    expect(timeout).toHaveBeenCalledWith(8000);
  });

  // covers: content that is not JSON
  test('message content that is not JSON', async () => {
    mockFetch(async () => completion('Here is your copy: Sketch together!'));
    expect(await eventCopy('drawing')).toEqual(await template('drawing'));
  });

  // covers: a field over its length limit (title is limited to 90 characters)
  test('a field over its length limit', async () => {
    mockFetch(async () => completion(JSON.stringify({ ...goodCopy, title: 'x'.repeat(91) })));
    expect(await eventCopy('drawing')).toEqual(await template('drawing'));
  });
});
