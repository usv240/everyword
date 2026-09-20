/**
 * The Fire TV app as a client of EveryWord's own MCP server.
 *
 * Why this file exists
 * --------------------
 * `record_reading_session` describes itself, in the tool list the
 * deployed server hands to any assistant, as: "The player calls this as
 * the karaoke cursor advances, which is what makes progress real rather
 * than self-reported."
 *
 * No player called it. The only callers in the repository were tests. So
 * `get_reading_progress` could only ever return what an assistant had
 * itself written, which is exactly the self-reported number that sentence
 * promises it is not. The two tracks this project enters, Fire TV and
 * Alexa+, were two separate products that shared a package.
 *
 * Now the television reports what was actually read. Ask Alexa+ how far
 * your child got and the answer comes from the cursor on the TV.
 *
 * Why the full protocol rather than a REST endpoint
 * ------------------------------------------------
 * There is no REST endpoint; `/mcp` is the only way in, and adding a
 * private back door for our own client would have made the TV app a
 * privileged caller and the MCP surface a demo. Instead the TV speaks the
 * same Streamable HTTP transport an assistant speaks, to the same
 * deployed server, with no shared secret. If the transport breaks for
 * Alexa+ it breaks for the television, which is the right coupling.
 *
 * Failure is silent on purpose
 * ----------------------------
 * A child reading in a living room must never see a network error. Every
 * call is wrapped, nothing is retried on screen, and the reader works
 * with the network unplugged. The only thing lost is a progress row.
 */

const MCP_URL =
  'https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp';
const PROTOCOL = '2025-11-25';

/** How long the whole handshake-and-report gets before we give up. */
const TIMEOUT_MS = 6000;

export interface Session {
  readerId: string;
  slug: string;
  wordsFollowed: number;
  completed: boolean;
}

export interface Reporter {
  report(session: Session): Promise<boolean>;
}

async function post(
  url: string,
  body: object,
  signal: AbortSignal,
  sessionId?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
    headers['mcp-protocol-version'] = PROTOCOL;
  }
  return fetch(url, {method: 'POST', headers, body: JSON.stringify(body), signal});
}

/**
 * One session: initialize, finish the handshake, call the tool, close.
 *
 * The DELETE is not optional politeness. The server holds a session id
 * until it is terminated, and a television that opens one per story and
 * never closes them would leak them for as long as the Lambda lives.
 */
export function createReporter(url: string = MCP_URL): Reporter {
  return {
    async report(session: Session): Promise<boolean> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let sessionId: string | undefined;
      try {
        const init = await post(
          url,
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: PROTOCOL,
              capabilities: {},
              clientInfo: {name: 'everyword-firetv', version: '1'},
            },
          },
          controller.signal,
        );
        sessionId = init.headers.get('mcp-session-id') ?? undefined;
        if (!init.ok || !sessionId) {
          return false;
        }

        await post(
          url,
          {jsonrpc: '2.0', method: 'notifications/initialized'},
          controller.signal,
          sessionId,
        );

        const call = await post(
          url,
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {name: 'record_reading_session', arguments: session},
          },
          controller.signal,
          sessionId,
        );
        return call.ok;
      } catch {
        // Offline, slow, or the Lambda is cold. The reader does not care.
        return false;
      } finally {
        clearTimeout(timer);
        if (sessionId) {
          try {
            await fetch(url, {
              method: 'DELETE',
              headers: {'mcp-session-id': sessionId},
            });
          } catch {
            // Nothing useful to do; the server expires sessions anyway.
          }
        }
      }
    },
  };
}
