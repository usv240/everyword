/**
 * @format
 *
 * The television reporting what was actually read.
 *
 * `record_reading_session` tells every assistant that reads the tool
 * list: "The player calls this as the karaoke cursor advances, which is
 * what makes progress real rather than self-reported." Until this client
 * existed no player called it, so the only progress an assistant could
 * read was progress an assistant had written. These tests pin the
 * sentence true.
 *
 * The second half of the file is about failure. A child reading in a
 * living room must never see a network error, so every path here has to
 * end quietly.
 */

import {createReporter} from '../src/mcp';

const URL = 'https://example.test/mcp';
const SESSION = 'session-abc-123';

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(
  plan: (call: number, recorded: Recorded) => Partial<Response> & {headers?: Headers},
) {
  const calls: Recorded[] = [];
  const fn = jest.fn(async (url: string, init: RequestInit = {}) => {
    const recorded: Recorded = {
      url,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : null,
    };
    calls.push(recorded);
    const res = plan(calls.length, recorded);
    return {
      ok: res.ok ?? true,
      status: res.status ?? 200,
      headers: res.headers ?? new Headers(),
    } as Response;
  });
  return {fn, calls};
}

const withSession = new Headers({'mcp-session-id': SESSION});

test('runs a full session and reports the words that were read', async () => {
  const {fn, calls} = fakeFetch(n => (n === 1 ? {headers: withSession} : {}));
  global.fetch = fn as unknown as typeof fetch;

  const ok = await createReporter(URL).report({
    readerId: 'firetv-household',
    slug: 'two-pots',
    wordsFollowed: 142,
    completed: false,
  });

  expect(ok).toBe(true);

  // initialize, notifications/initialized, tools/call, DELETE.
  expect(calls).toHaveLength(4);

  expect((calls[0].body as any).method).toBe('initialize');
  expect((calls[0].body as any).params.protocolVersion).toBe('2025-11-25');
  expect((calls[0].body as any).params.clientInfo.name).toBe('everyword-firetv');

  expect((calls[1].body as any).method).toBe('notifications/initialized');
  expect(calls[1].headers['mcp-session-id']).toBe(SESSION);

  const call = calls[2].body as any;
  expect(call.method).toBe('tools/call');
  expect(call.params.name).toBe('record_reading_session');
  expect(call.params.arguments).toEqual({
    readerId: 'firetv-household',
    slug: 'two-pots',
    wordsFollowed: 142,
    completed: false,
  });
  expect(calls[2].headers['mcp-protocol-version']).toBe('2025-11-25');
});

test('closes the session it opened', async () => {
  const {fn, calls} = fakeFetch(n => (n === 1 ? {headers: withSession} : {}));
  global.fetch = fn as unknown as typeof fetch;

  await createReporter(URL).report({
    readerId: 'r',
    slug: 'two-pots',
    wordsFollowed: 5,
    completed: true,
  });

  // A television that opened a session per story and never closed one
  // would leak session ids for as long as the Lambda lives.
  const last = calls[calls.length - 1];
  expect(last.method).toBe('DELETE');
  expect(last.headers['mcp-session-id']).toBe(SESSION);
});

test('gives up quietly when the server will not open a session', async () => {
  const {fn, calls} = fakeFetch(() => ({ok: false, status: 503}));
  global.fetch = fn as unknown as typeof fetch;

  const ok = await createReporter(URL).report({
    readerId: 'r',
    slug: 'two-pots',
    wordsFollowed: 5,
    completed: false,
  });

  expect(ok).toBe(false);
  // Nothing further is attempted, and nothing is thrown at the reader.
  expect(calls).toHaveLength(1);
});

test('gives up quietly when the network is gone', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('Network request failed');
  }) as unknown as typeof fetch;

  await expect(
    createReporter(URL).report({
      readerId: 'r',
      slug: 'two-pots',
      wordsFollowed: 5,
      completed: false,
    }),
  ).resolves.toBe(false);
});

test('reports a failure when the tool call itself is rejected', async () => {
  const {fn} = fakeFetch(n => {
    if (n === 1) {
      return {headers: withSession};
    }
    return n === 3 ? {ok: false, status: 400} : {};
  });
  global.fetch = fn as unknown as typeof fetch;

  const ok = await createReporter(URL).report({
    readerId: 'r',
    slug: 'two-pots',
    wordsFollowed: 5,
    completed: false,
  });
  expect(ok).toBe(false);
});
