import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { buildServer } from "../src/server";
import { MCP_PROTOCOL_VERSION } from "../src/mcp";
import { summarize, completedSlugs, MemoryProgressStore } from "../src/progress";
import { loadLibrary, resolveStory } from "../src/library";

/**
 * MCP transport conformance against spec revision 2025-11-25, plus the
 * behaviour of the five reading tools.
 *
 * The library is loaded from the real content directory the web reader
 * serves, so these tests fail if the shipped catalogue and the agent's view
 * of it ever diverge.
 */

const CONTENT_DIR = join(__dirname, "..", "..", "web", "public", "content");

type Injected = Awaited<ReturnType<ReturnType<typeof buildServer>["app"]["inject"]>>;

describe("EveryWord MCP (Streamable HTTP, 2025-11-25)", () => {
  const { app } = buildServer({ contentDir: CONTENT_DIR });

  const post = (
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<Injected> =>
    app.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...headers,
      },
      payload: JSON.stringify(body),
    });

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await post(
      { jsonrpc: "2.0", id: 99, method: "tools/call", params: { name, arguments: args } },
      { "mcp-session-id": sessionId },
    );
    const body = res.json();
    if (body.error) return { error: body.error };
    return JSON.parse(body.result.content[0].text);
  };

  let sessionId = "";

  beforeAll(async () => {
    const res = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    });
    sessionId = res.headers["mcp-session-id"] as string;
  });

  it("initialize returns the protocol version, server info, and a session id", async () => {
    const res = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(body.result.serverInfo.name).toBe("everyword-mcp");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(res.headers["mcp-session-id"]).toMatch(/[0-9a-f-]{36}/);
  });

  it("rejects non-initialize requests without a session", async () => {
    const res = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects unknown sessions with 404", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 3, method: "tools/list" },
      { "mcp-session-id": "00000000-0000-0000-0000-000000000000" },
    );
    expect(res.statusCode).toBe(404);
  });

  it("rejects unsupported protocol versions with 400", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 4, method: "tools/list" },
      { "mcp-session-id": sessionId, "mcp-protocol-version": "1999-01-01" },
    );
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-loopback origins with 403", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 5, method: "tools/list" },
      { "mcp-session-id": sessionId, origin: "https://evil.example.com" },
    );
    expect(res.statusCode).toBe(403);
  });

  it("accepts notifications with 202 and no body", async () => {
    const res = await post(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { "mcp-session-id": sessionId },
    );
    expect(res.statusCode).toBe(202);
    expect(res.body).toBe("");
  });

  it("rejects JSON-RPC batches, which this revision removed", async () => {
    const res = await post([{ jsonrpc: "2.0", id: 1, method: "ping" }], {
      "mcp-session-id": sessionId,
    });
    expect(res.statusCode).toBe(400);
  });

  it("lists the six reading tools", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 6, method: "tools/list" },
      { "mcp-session-id": sessionId, "mcp-protocol-version": MCP_PROTOCOL_VERSION },
    );
    const tools = res.json().result.tools as Array<{ name: string }>;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "explain_word",
      "get_reading_progress",
      "get_story_text",
      "list_library",
      "recommend_story",
      "record_reading_session",
    ]);
  });

  it("list_library reports the real shipped catalogue", async () => {
    const out = await call("list_library");
    expect(out.stories.length).toBeGreaterThanOrEqual(5);
    const lion = out.stories.find((s: { slug: string }) => s.slug === "lion-and-mouse");
    expect(lion.title).toBe("The Lion and the Mouse");
    // Counted from the caption document, not read from the manifest.
    expect(lion.words).toBeGreaterThan(100);
    expect(lion.wordsPerMinute).toBeGreaterThan(60);
    expect(lion.wordsPerMinute).toBeLessThan(400);
  });

  it("get_story_text returns the lines the reader actually sees", async () => {
    const out = await call("get_story_text", { slug: "lion-and-mouse" });
    expect(Array.isArray(out.lines)).toBe(true);
    expect(out.lines.length).toBeGreaterThan(3);
    expect(out.lines.join(" ").toLowerCase()).toContain("lion");
  });

  it("recommend_story picks the shortest story and explains why", async () => {
    const out = await call("recommend_story", { readerId: "maya" });
    expect(out.found).toBe(true);
    expect(out.pick.slug).toBeTruthy();
    expect(out.reason).toContain("Shortest");
  });

  it("recommend_story honours a length constraint and reports it", async () => {
    const out = await call("recommend_story", { readerId: "maya", maxMinutes: 0.5 });
    if (out.found) {
      expect(out.pick.durationSeconds).toBeLessThanOrEqual(30);
      expect(out.constraintsApplied.join(" ")).toContain("0.5 minutes");
    } else {
      expect(out.message).toContain("No story matches");
    }
  });

  it("recommend_story reports honestly when nothing matches", async () => {
    const out = await call("recommend_story", { readerId: "maya", maxMinutes: 0.01 });
    expect(out.found).toBe(false);
    expect(out.message).toContain("No story matches");
  });

  it("records a session, then reflects it in progress", async () => {
    const before = await call("get_reading_progress", { readerId: "sam" });
    expect(before.totalWordsRead).toBe(0);
    expect(before.lastReadAt).toBeNull();

    const rec = await call("record_reading_session", {
      readerId: "sam",
      slug: "lion-and-mouse",
      wordsFollowed: 120,
      completed: true,
    });
    expect(rec.recorded).toBe(true);

    const after = await call("get_reading_progress", { readerId: "sam" });
    expect(after.totalWordsRead).toBe(120);
    expect(after.sessions).toBe(1);
    expect(after.storiesCompleted).toBe(1);
    expect(after.currentStreakDays).toBe(1);
    expect(after.wordsThisWeek).toBe(120);
  });

  it("caps a session at the story's real length, so progress cannot be inflated", async () => {
    const rec = await call("record_reading_session", {
      readerId: "capped",
      slug: "crow-and-pitcher",
      wordsFollowed: 999999,
    });
    expect(rec.cappedToStoryLength).toBe(true);
    expect(rec.wordsFollowed).toBe(rec.storyWords);
  });

  it("recommend_story skips stories the reader has already finished", async () => {
    const first = await call("recommend_story", { readerId: "skipper" });
    await call("record_reading_session", {
      readerId: "skipper",
      slug: first.pick.slug,
      wordsFollowed: 10,
      completed: true,
    });
    const second = await call("recommend_story", { readerId: "skipper" });
    expect(second.pick.slug).not.toBe(first.pick.slug);
    expect(second.constraintsApplied.join(" ")).toContain("already finished");
  });

  it("returns JSON-RPC errors for unknown tools, unknown stories, and unknown methods", async () => {
    const badTool = await call("does_not_exist");
    expect(badTool.error.code).toBe(-32602);

    const badStory = await call("get_story_text", { slug: "nope" });
    expect(badStory.error.code).toBe(-32602);

    const badMethod = await post(
      { jsonrpc: "2.0", id: 11, method: "resources/list" },
      { "mcp-session-id": sessionId },
    );
    expect(badMethod.json().error.code).toBe(-32601);
  });

  it("GET /mcp responds 405 with an Allow header", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp" });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toContain("POST");
  });

  it("DELETE terminates the session; later requests get 404", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: "/mcp",
      headers: { "mcp-session-id": sessionId },
    });
    expect(del.statusCode).toBe(204);
    const after = await post(
      { jsonrpc: "2.0", id: 12, method: "tools/list" },
      { "mcp-session-id": sessionId },
    );
    expect(after.statusCode).toBe(404);
  });
});

/**
 * Regression, carried over from Nightlight rather than rediscovered: a real
 * MCP client terminates a session with DELETE carrying a JSON content-type
 * and an empty body. inject() sends no content-type unless asked, so the
 * conformance test above does not produce that shape and a naive body
 * parser answers 500.
 */
describe("session termination from a real client", () => {
  it("accepts DELETE carrying a JSON content-type and an empty body", async () => {
    const { app } = buildServer({ contentDir: CONTENT_DIR });
    const init = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "c", version: "1" },
        },
      }),
    });
    const sessionId = init.headers["mcp-session-id"] as string;

    const del = await app.inject({
      method: "DELETE",
      url: "/mcp",
      headers: { "content-type": "application/json", "mcp-session-id": sessionId },
      payload: "",
    });
    expect(del.statusCode).toBe(204);
    await app.close();
  });

  it("answers a malformed body with -32700 rather than a transport 500", async () => {
    // The same lesson a second time, and again found against the deployed
    // Lambda rather than here: JSON-RPC calls an unparseable body a Parse
    // error, so it belongs in the protocol with a client-error status. A 500
    // tells a client to retry something that cannot succeed and leaks the
    // framework's error envelope. Found by scripts/mcp-conform.mjs in the
    // Nightlight repository, which speaks real HTTP.
    const { app } = buildServer({ contentDir: CONTENT_DIR });
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json" },
      payload: "{ this is not json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe(-32700);
    await app.close();
  });
});

/**
 * Progress is derived, never stored pre-aggregated. These test the pure
 * functions directly, which is what lets the identical computation run over
 * memory in tests and over DynamoDB in production.
 */
describe("progress derivations", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString();

  it("counts a consecutive-day streak, and lets yesterday still count", () => {
    const sessions = [3, 4, 5].map((d) => ({
      readerId: "r",
      slug: "s",
      wordsFollowed: 10,
      completed: false,
      at: day(d),
    }));
    // "Today" is the 6th: the run ended yesterday, which still counts, because
    // a streak that broke before the day was over would punish someone who
    // simply has not read yet this evening.
    const sum = summarize(sessions, "r", new Date(Date.UTC(2026, 0, 6, 9)));
    expect(sum.currentStreakDays).toBe(3);
  });

  it("breaks a streak across a missed day", () => {
    const sessions = [1, 2, 5].map((d) => ({
      readerId: "r",
      slug: "s",
      wordsFollowed: 10,
      completed: false,
      at: day(d),
    }));
    const sum = summarize(sessions, "r", new Date(Date.UTC(2026, 0, 5, 9)));
    expect(sum.currentStreakDays).toBe(1);
  });

  it("separates this week from last week", () => {
    const now = new Date(Date.UTC(2026, 0, 20));
    const sessions = [
      { readerId: "r", slug: "a", wordsFollowed: 100, completed: true, at: day(18) },
      { readerId: "r", slug: "b", wordsFollowed: 40, completed: false, at: day(10) },
    ];
    const sum = summarize(sessions, "r", now);
    expect(sum.wordsThisWeek).toBe(100);
    expect(sum.wordsPreviousWeek).toBe(40);
    expect(sum.totalWordsRead).toBe(140);
    expect(sum.storiesCompleted).toBe(1);
  });

  it("completedSlugs counts only finished stories", () => {
    const set = completedSlugs([
      { readerId: "r", slug: "a", wordsFollowed: 1, completed: true, at: day(1) },
      { readerId: "r", slug: "b", wordsFollowed: 1, completed: false, at: day(1) },
    ]);
    expect([...set]).toEqual(["a"]);
  });

  it("the memory store keeps readers apart", async () => {
    const store = new MemoryProgressStore();
    await store.record({ readerId: "a", slug: "s", wordsFollowed: 5, completed: true, at: day(1) });
    await store.record({ readerId: "b", slug: "s", wordsFollowed: 7, completed: true, at: day(1) });
    expect((await store.list("a")).length).toBe(1);
    expect((await store.list("a"))[0]!.wordsFollowed).toBe(5);
  });
});

/**
 * explain_word: the one place a model touches what a reader sees.
 *
 * The claims under test are the fences, not the prose: the word must really
 * be in the story, the explanation is grounded in the sentence it appeared
 * in, and total model failure still leaves the reader with something true.
 */
describe("explain_word grounding and fallback", () => {
  const CONTENT = join(__dirname, "..", "..", "web", "public", "content");

  async function session(explain: Record<string, unknown> = {}) {
    const { app, library } = buildServer({ contentDir: CONTENT, explain: explain as never });
    const init = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "t", version: "1" } },
      }),
    });
    const sid = init.headers["mcp-session-id"] as string;
    const call = async (name: string, args: Record<string, unknown>) => {
      const res = await app.inject({
        method: "POST", url: "/mcp",
        headers: { "content-type": "application/json", "mcp-session-id": sid },
        payload: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }),
      });
      const body = res.json();
      return body.error ? { error: body.error } : JSON.parse(body.result.content[0].text);
    };
    return { call, library };
  }

  it("refuses a word that is not in the story rather than defining something else", async () => {
    let called = false;
    const { call } = await session({
      models: ["m"],
      createText: async () => { called = true; return "nope"; },
    });
    const out = await call("explain_word", { slug: "crow-and-pitcher", word: "helicopter" });
    expect(out.found).toBe(false);
    expect(out.source).toBe("not-in-story");
    // The model is never consulted: the check happens before any call.
    expect(called).toBe(false);
  });

  it("grounds the explanation in the sentence the word appears in", async () => {
    let seenPrompt = "";
    const { call } = await session({
      models: ["m"],
      createText: async (_s: string, u: string) => { seenPrompt = u; return "A pitcher is a jug that holds water."; },
    });
    const out = await call("explain_word", { slug: "crow-and-pitcher", word: "pitcher" });
    expect(out.found).toBe(true);
    expect(out.source).toBe("bedrock");
    expect(out.explanation).toContain("jug");
    // The real sentence from the caption document is handed to the model.
    expect(seenPrompt.toLowerCase()).toContain("pitcher");
    expect(out.context.toLowerCase()).toContain("pitcher");
  });

  it("matches a word even when it carries punctuation in the captions", async () => {
    const { call } = await session({
      models: ["m"],
      createText: async () => "A crow is a large black bird.",
    });
    const out = await call("explain_word", { slug: "crow-and-pitcher", word: "Crow," });
    expect(out.found).toBe(true);
  });

  it("descends the model ladder", async () => {
    const { call } = await session({
      models: ["gated", "ok"],
      createText: async (_s: string, _u: string, model: string) => {
        if (model === "gated") throw new Error("AccessDeniedException");
        return "A jug for water.";
      },
    });
    const out = await call("explain_word", { slug: "crow-and-pitcher", word: "pitcher" });
    expect(out.model).toBe("ok");
    expect(out.attempts[0]).toMatchObject({ model: "gated", ok: false });
  });

  it("falls back to showing the reader their own sentence when every model fails", async () => {
    const { call } = await session({
      models: ["a", "b"],
      createText: async () => { throw new Error("region unavailable"); },
    });
    const out = await call("explain_word", { slug: "crow-and-pitcher", word: "pitcher" });
    // Less helpful than a definition, and impossible to be wrong.
    expect(out.found).toBe(true);
    expect(out.source).toBe("context-only");
    expect(out.context).toBeTruthy();
    expect(out.explanation).toBeUndefined();
    expect(out.attempts).toHaveLength(2);
  });
});

/**
 * Story resolution: meet the caller where they are.
 *
 * Found by a real agent, not by a test: asked about "The Crow and the
 * Pitcher" it guessed the slug "the-crow-and-the-pitcher" and got "Unknown
 * story". A parent says the title. The server should understand it.
 */
describe("resolveStory accepts what a human would say", () => {
  const library = loadLibrary(join(__dirname, "..", "..", "web", "public", "content"));

  it("exact slug", () => {
    expect(resolveStory(library, "crow-and-pitcher")?.slug).toBe("crow-and-pitcher");
  });
  it("the title, any case", () => {
    expect(resolveStory(library, "the crow and the pitcher")?.slug).toBe("crow-and-pitcher");
    expect(resolveStory(library, "The Crow and the Pitcher")?.slug).toBe("crow-and-pitcher");
  });
  it("the slug an agent guessed from the title", () => {
    expect(resolveStory(library, "the-crow-and-the-pitcher")?.slug).toBe("crow-and-pitcher");
  });
  it("still rejects genuine nonsense, and never picks a wrong story", () => {
    expect(resolveStory(library, "moby dick")).toBeNull();
    expect(resolveStory(library, "")).toBeNull();
    expect(resolveStory(library, 42)).toBeNull();
  });
  it("does not confuse two real stories", () => {
    expect(resolveStory(library, "The Lion and the Mouse")?.slug).toBe("lion-and-mouse");
    expect(resolveStory(library, "hare and tortoise")?.slug).toBe("hare-and-tortoise");
  });
});
