import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadLibrary, type Story } from "./library";
import { registerMcp } from "./mcp";
import { MemoryProgressStore, type ProgressStore } from "./progress";
import { MODEL_LADDER } from "./explain";

/**
 * The EveryWord MCP server.
 *
 * POST/GET/DELETE /mcp   Model Context Protocol, spec 2025-11-25,
 *                        Streamable HTTP. This is the Alexa+ surface.
 * GET /healthz           liveness
 */

export function buildServer(
  opts: {
    library?: Story[];
    progress?: ProgressStore;
    contentDir?: string;
    explain?: import("./explain").ExplainDeps;
    librarySource?: "remote" | "local";
  } = {},
) {
  const app = Fastify({ logger: false });
  const library = opts.library ?? loadLibrary(opts.contentDir);
  const progress = opts.progress ?? new MemoryProgressStore();

  // Capture the raw body, tolerate an empty one, and report a malformed one
  // as data rather than as a transport failure.
  //
  // An empty body with a JSON content-type is legal and common: real MCP
  // clients send exactly that on DELETE when terminating a session. In the
  // Nightlight codebase this surfaced as a 500 that thirteen conformance
  // tests missed, because Fastify's inject() sends no content-type unless
  // asked and so never produced the shape a real client sends. It was found
  // by pointing an actual agent at the server. The fix is carried here from
  // the start, and the regression test below pins it.
  //
  // Malformed JSON is the same lesson a second time. Handing the parse error
  // to `done` lets Fastify answer with its own 500 envelope, but JSON-RPC is
  // explicit that an unparseable body is a -32700 Parse error, and a 500
  // tells a client to retry something that will never succeed. Found on the
  // deployed Lambda by the conformance probe in the Nightlight repository
  // (scripts/mcp-conform.mjs), which speaks real HTTP; every injected test
  // here passed while the live server was wrong.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      const raw = body as Buffer;
      if (raw.length === 0) {
        done(null, { raw, json: undefined });
        return;
      }
      try {
        done(null, { raw, json: JSON.parse(raw.toString("utf8")) });
      } catch (err) {
        done(null, { raw, json: undefined, parseError: (err as Error).message });
      }
    },
  );

  app.register(cors, { origin: true });

  app.get("/healthz", async () => ({
    ok: true,
    stories: library.length,
    protocol: "2025-11-25",
  }));

  /**
   * Resilience posture: what this deployment does when things fail.
   * Exposed because a fallback nobody can see is indistinguishable from one
   * that does not exist.
   */
  app.get("/api/resilience", async () => ({
    catalogue: {
      source: opts.librarySource ?? "local",
      remote: "the deployed content directory on CloudFront, retried with backoff",
      onRemoteFailure: "serve the bundled copy and report it",
      rationale:
        "The remote copy is authoritative because it is what the reader serves. But a server that cannot start because a CDN had a bad minute is worse than one running a catalogue a deploy behind, with the degradation reported rather than hidden.",
    },
    progress: {
      store: progress instanceof MemoryProgressStore ? "in-memory" : "dynamodb",
      design: "append-only session log; every reported number is derived, never stored pre-aggregated",
      rationale: "A summary cannot drift from the sessions that produced it, and the identical derivation runs over memory in tests and DynamoDB in production.",
    },
    explainWord: {
      modelLadder: MODEL_LADDER,
      onTotalFailure: "return the sentence the word appears in, and say no explanation is available",
      guard: "the word must appear in the story's caption document before any model is called",
      rationale: "Showing a reader their own context is less helpful than a definition and impossible to be wrong.",
    },
    timing: {
      usesModels: false,
      rationale: "The karaoke cursor is pure binary-search math over measured word timings. Nothing here calls a model, so there is nothing to fall back from.",
    },
    captionPipelines: {
      paths: ["amazon-transcribe (human narration)", "amazon-polly (any text, zero word error by construction)"],
      rationale: "Two independent routes into the same caption format, so a story can be produced whichever input the content has.",
    },
  }));

  registerMcp(app, { library, progress, explain: opts.explain ?? {} });

  return { app, library, progress };
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("src/server.ts") ?? false;
if (isMain) {
  const { app, library } = buildServer();
  const port = Number(process.env.PORT ?? 8788);
  app
    .listen({ port, host: "127.0.0.1" })
    .then(() =>
      console.log(
        `EveryWord MCP server on http://127.0.0.1:${port}/mcp (${library.length} stories)`,
      ),
    )
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
