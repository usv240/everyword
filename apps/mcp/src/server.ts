import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadLibrary, type Story } from "./library";
import { registerMcp } from "./mcp";
import { ProgressStore } from "./progress";

/**
 * The EveryWord MCP server.
 *
 * POST/GET/DELETE /mcp   Model Context Protocol, spec 2025-11-25,
 *                        Streamable HTTP. This is the Alexa+ surface.
 * GET /healthz           liveness
 */

export function buildServer(
  opts: { library?: Story[]; progress?: ProgressStore; contentDir?: string } = {},
) {
  const app = Fastify({ logger: false });
  const library = opts.library ?? loadLibrary(opts.contentDir);
  const progress = opts.progress ?? new ProgressStore();

  // Capture the raw body and tolerate an empty one.
  //
  // An empty body with a JSON content-type is legal and common: real MCP
  // clients send exactly that on DELETE when terminating a session. In the
  // Nightlight codebase this surfaced as a 500 that thirteen conformance
  // tests missed, because Fastify's inject() sends no content-type unless
  // asked and so never produced the shape a real client sends. It was found
  // by pointing an actual agent at the server. The fix is carried here from
  // the start, and the regression test below pins it.
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
        done(err as Error);
      }
    },
  );

  app.register(cors, { origin: true });

  app.get("/healthz", async () => ({
    ok: true,
    stories: library.length,
    protocol: "2025-11-25",
  }));

  registerMcp(app, { library, progress });

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
