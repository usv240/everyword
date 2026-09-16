import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, storyLines, type Story } from "./library";
import { completedSlugs, summarize, type ProgressStore } from "./progress";

/**
 * MCP server for EveryWord, implementing the Model Context Protocol spec
 * revision 2025-11-25 over the Streamable HTTP transport.
 *
 * Why an agent surface belongs on a reading product:
 *
 * EveryWord measures something no other reading tool can, which is how many
 * words a person actually read along with rather than how many minutes of
 * video played. That number is useless sitting in a database. The adult who
 * cares about a child's reading does not open dashboards; they ask a
 * question out loud while doing something else. So the division of labour
 * is: the screen does the reading practice, the agent does the noticing.
 *
 * The server is also a second, independent consumer of
 * @everyword/captions-core. It counts words and durations from the caption
 * documents themselves rather than trusting the manifest, which means the
 * numbers an agent reports are the same numbers that drive the karaoke
 * cursor. If the package were wrong, this server would be wrong too.
 *
 * Transport behaviour, per the spec:
 * - POST /mcp: JSON-RPC 2.0 requests and notifications, answered as JSON.
 * - GET /mcp: 405 with an Allow header. The spec permits exactly this for a
 *   server that offers no server-initiated SSE stream.
 * - DELETE /mcp: terminates the session (204).
 * - MCP-Session-Id issued on initialize and required thereafter: missing is
 *   400, unknown or terminated is 404.
 * - MCP-Protocol-Version validated when present.
 * - Origin must be loopback when present, per the DNS-rebinding guidance.
 */

export const MCP_PROTOCOL_VERSION = "2025-11-25";
/** Older revision accepted for header-less backwards compatibility only. */
const FALLBACK_PROTOCOL_VERSION = "2025-03-26";

const SERVER_INFO = { name: "everyword-mcp", version: "0.1.0" };

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: "list_library",
    description:
      "Every story available to read along with, including its word count, spoken duration, and narration pace in words per minute. Pace is the practical difficulty signal: a slower story is easier to follow for a developing reader.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "recommend_story",
    description:
      "Pick one story for a reader, with the reason for the choice. Use this for requests like 'something short before bed' or 'something she has not read yet'. Returns the pick plus the constraints that were applied, so the choice can be explained rather than asserted.",
    inputSchema: {
      type: "object",
      properties: {
        readerId: {
          type: "string",
          description: "Who is reading; used to skip stories they have finished",
        },
        maxMinutes: {
          type: "number",
          minimum: 0.1,
          maximum: 60,
          description: "Longest acceptable story in minutes",
        },
        maxWordsPerMinute: {
          type: "integer",
          minimum: 40,
          maximum: 400,
          description: "Slowest-narration preference; lower is easier to follow",
        },
        excludeCompleted: {
          type: "boolean",
          description: "Skip stories this reader has already finished (default true)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_reading_progress",
    description:
      "How much a reader has actually read: total words followed, sessions, stories completed, current daily streak, and this week against last week. Words followed means words the karaoke cursor passed while they were reading, not minutes of video played.",
    inputSchema: {
      type: "object",
      properties: {
        readerId: { type: "string", description: "Who to report on" },
      },
      required: ["readerId"],
      additionalProperties: false,
    },
  },
  {
    name: "record_reading_session",
    description:
      "Record that a reader finished a reading session. The player calls this as the karaoke cursor advances, which is what makes progress real rather than self-reported.",
    inputSchema: {
      type: "object",
      properties: {
        readerId: { type: "string", description: "Who was reading" },
        slug: { type: "string", description: "Story slug from list_library" },
        wordsFollowed: {
          type: "integer",
          minimum: 0,
          description: "Words the cursor passed while the reader was present",
        },
        completed: {
          type: "boolean",
          description: "Whether the story was played to the end (default false)",
        },
      },
      required: ["readerId", "slug", "wordsFollowed"],
      additionalProperties: false,
    },
  },
  {
    name: "get_story_text",
    description:
      "The full text of one story, as the reader sees it, one entry per displayed line. Use this to answer questions about a story or to read a passage aloud. The text comes from the caption document, so it is exactly what is on screen.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Story slug from list_library" },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
];

const textContent = (payload: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 1) }],
});

const rpcResult = (id: number | string | null, result: unknown) => ({
  jsonrpc: "2.0" as const,
  id,
  result,
});

const rpcError = (
  id: number | string | null,
  code: number,
  message: string,
) => ({ jsonrpc: "2.0" as const, id, error: { code, message } });

export function registerMcp(
  app: FastifyInstance,
  deps: { library: Story[]; progress: ProgressStore },
): void {
  const sessions = new Set<string>();

  const checkOrigin = (req: FastifyRequest, reply: FastifyReply): boolean => {
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin.length > 0) {
      const ok = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
      if (!ok) {
        reply.code(403).send(rpcError(null, -32600, "Origin not allowed"));
        return false;
      }
    }
    return true;
  };

  const findStory = (slug: unknown): Story => {
    const story = deps.library.find((s) => s.slug === slug);
    if (!story) {
      throw Object.assign(new Error(`Unknown story: ${String(slug)}`), {
        code: -32602,
      });
    }
    return story;
  };

  const callTool = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    switch (name) {
      case "list_library": {
        return textContent({
          stories: deps.library.map(describe),
          note: "Word counts and durations are computed from the caption documents, not from metadata.",
        });
      }

      case "recommend_story": {
        const readerId = typeof args.readerId === "string" ? args.readerId : undefined;
        const excludeCompleted = args.excludeCompleted !== false;
        const maxMinutes =
          typeof args.maxMinutes === "number" ? args.maxMinutes : undefined;
        const maxWpm =
          typeof args.maxWordsPerMinute === "number"
            ? args.maxWordsPerMinute
            : undefined;

        const done =
          readerId && excludeCompleted
            ? completedSlugs(await deps.progress.list(readerId))
            : new Set<string>();

        const applied: string[] = [];
        let pool = deps.library;
        if (done.size > 0) {
          pool = pool.filter((s) => !done.has(s.slug));
          applied.push(`skipping ${done.size} already finished`);
        }
        if (maxMinutes !== undefined) {
          pool = pool.filter((s) => s.durationSec <= maxMinutes * 60);
          applied.push(`at most ${maxMinutes} minutes`);
        }
        if (maxWpm !== undefined) {
          pool = pool.filter((s) => s.wordsPerMinute <= maxWpm);
          applied.push(`at most ${maxWpm} words per minute`);
        }

        if (pool.length === 0) {
          return textContent({
            found: false,
            constraintsApplied: applied,
            message:
              "No story matches those constraints. Relaxing the length limit or allowing a re-read would widen the choice.",
          });
        }

        // Shortest first: for a developing reader a finishable story beats an
        // ambitious one, and finishing is what produces the streak.
        const pick = [...pool].sort((a, b) => a.durationSec - b.durationSec)[0]!;
        return textContent({
          found: true,
          pick: describe(pick),
          constraintsApplied: applied,
          reason:
            applied.length > 0
              ? `Shortest story that satisfies: ${applied.join(", ")}.`
              : "Shortest story in the library, which is the easiest one to finish.",
          alternatives: pool
            .filter((s) => s.slug !== pick.slug)
            .slice(0, 3)
            .map((s) => s.slug),
        });
      }

      case "get_reading_progress": {
        const readerId = typeof args.readerId === "string" ? args.readerId : "";
        if (!readerId) {
          throw Object.assign(new Error("readerId is required"), { code: -32602 });
        }
        const summary = summarize(await deps.progress.list(readerId), readerId);
        const trend =
          summary.wordsPreviousWeek === 0
            ? summary.wordsThisWeek > 0
              ? "first week with recorded reading"
              : "nothing recorded yet"
            : summary.wordsThisWeek >= summary.wordsPreviousWeek
              ? `up ${summary.wordsThisWeek - summary.wordsPreviousWeek} words on last week`
              : `down ${summary.wordsPreviousWeek - summary.wordsThisWeek} words on last week`;
        return textContent({
          ...summary,
          trend,
          note: "Words read means words the karaoke cursor passed while the reader was present, not minutes of playback.",
        });
      }

      case "record_reading_session": {
        const readerId = typeof args.readerId === "string" ? args.readerId : "";
        const wordsFollowed =
          typeof args.wordsFollowed === "number" ? Math.floor(args.wordsFollowed) : -1;
        if (!readerId || wordsFollowed < 0) {
          throw Object.assign(
            new Error("readerId and a non-negative wordsFollowed are required"),
            { code: -32602 },
          );
        }
        const story = findStory(args.slug);
        // A session cannot claim more words than the story contains.
        const capped = Math.min(wordsFollowed, story.words);
        const session = {
          readerId,
          slug: story.slug,
          wordsFollowed: capped,
          completed: args.completed === true,
          at: new Date().toISOString(),
        };
        deps.progress.record(session);
        return textContent({
          recorded: true,
          ...session,
          cappedToStoryLength: capped !== wordsFollowed,
          storyWords: story.words,
        });
      }

      case "get_story_text": {
        const story = findStory(args.slug);
        return textContent({
          ...describe(story),
          lines: storyLines(story),
        });
      }

      default:
        throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
    }
  };

  app.post("/mcp", async (req, reply) => {
    if (!checkOrigin(req, reply)) return;

    const body = (req.body as { json?: unknown })?.json;
    if (Array.isArray(body)) {
      return reply
        .code(400)
        .send(rpcError(null, -32600, "Batching is not part of this protocol revision"));
    }
    const msg = body as JsonRpcRequest | undefined;
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      return reply.code(400).send(rpcError(null, -32600, "Invalid JSON-RPC request"));
    }

    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
    const versionHeader = req.headers["mcp-protocol-version"];
    const version = Array.isArray(versionHeader) ? versionHeader[0] : versionHeader;

    if (
      version !== undefined &&
      version !== MCP_PROTOCOL_VERSION &&
      version !== FALLBACK_PROTOCOL_VERSION
    ) {
      return reply
        .code(400)
        .send(rpcError(msg.id ?? null, -32600, `Unsupported protocol version: ${version}`));
    }

    if (msg.method === "initialize") {
      const newSession = randomUUID();
      sessions.add(newSession);
      reply.header("MCP-Session-Id", newSession);
      return reply.send(
        rpcResult(msg.id ?? null, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "EveryWord turns watching into reading with word-by-word karaoke captions. Ask what is in the library, recommend a story for a reader, or report how many words someone has actually read. Report only numbers these tools return, and never estimate a reading level or diagnose a reading difficulty.",
        }),
      );
    }

    if (!sessionId) {
      return reply
        .code(400)
        .send(rpcError(msg.id ?? null, -32600, "Missing MCP-Session-Id header"));
    }
    if (!sessions.has(sessionId)) {
      return reply
        .code(404)
        .send(rpcError(msg.id ?? null, -32001, "Unknown or terminated session"));
    }

    // Notifications get 202 Accepted with no body.
    if (msg.id === undefined || msg.id === null) {
      return reply.code(202).send();
    }

    switch (msg.method) {
      case "ping":
        return reply.send(rpcResult(msg.id, {}));
      case "tools/list":
        return reply.send(rpcResult(msg.id, { tools: TOOLS }));
      case "tools/call": {
        const params = msg.params ?? {};
        const name = typeof params.name === "string" ? params.name : "";
        const args =
          typeof params.arguments === "object" && params.arguments !== null
            ? (params.arguments as Record<string, unknown>)
            : {};
        try {
          const result = await callTool(name, args);
          return reply.send(rpcResult(msg.id, result));
        } catch (err) {
          const code = (err as { code?: number }).code ?? -32603;
          return reply.send(rpcError(msg.id, code, (err as Error).message));
        }
      }
      default:
        return reply.send(rpcError(msg.id, -32601, `Method not found: ${msg.method}`));
    }
  });

  app.get("/mcp", async (_req, reply) =>
    reply.code(405).header("Allow", "POST, DELETE").send(),
  );

  app.delete("/mcp", async (req, reply) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
    if (sessionId && sessions.has(sessionId)) {
      sessions.delete(sessionId);
      return reply.code(204).send();
    }
    return reply.code(404).send();
  });
}
