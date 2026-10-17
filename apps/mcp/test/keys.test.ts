import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { buildServer } from "../src/server";
import { callerFrom, issueKey, spaceOf } from "../src/keys";

const PROTOCOL = "2025-11-25";
const CONTENT_DIR = join(__dirname, "..", "..", "web", "public", "content");

async function session(app: ReturnType<typeof buildServer>["app"], key?: string) {
  const auth = key ? { authorization: `Bearer ${key}` } : {};
  const init = await app.inject({
    method: "POST",
    url: "/mcp",
    headers: { "content-type": "application/json", ...auth },
    payload: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "t", version: "1" } } },
  });
  const sid = String(init.headers["mcp-session-id"]);
  let id = 10;
  return async (name: string, args: Record<string, unknown>) => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json", "mcp-session-id": sid, "mcp-protocol-version": PROTOCOL, ...auth },
      payload: { jsonrpc: "2.0", id: id++, method: "tools/call", params: { name, arguments: args } },
    });
    const body = res.json() as { result?: { content: { text: string }[] }; error?: { message: string } };
    return { body, data: body.result ? JSON.parse(body.result.content[0]!.text) : null };
  };
}

describe("API keys", () => {
  it("issues a key with no account, and stores nothing about it", async () => {
    const { app } = buildServer({ contentDir: CONTENT_DIR });
    const res = await app.inject({ method: "POST", url: "/v1/keys" });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { key: string; mcpClientConfig: unknown };
    expect(body.key).toMatch(/^ew_[A-Za-z0-9_-]{32}$/);
    expect(JSON.stringify(body.mcpClientConfig)).toContain(`Bearer ${body.key}`);
    expect(spaceOf(body.key)).toHaveLength(16);
  });

  it("gives a keyed caller a reader nobody else can see, and leaves the open server open", async () => {
    const { app } = buildServer({ contentDir: CONTENT_DIR });
    const mine = await session(app, issueKey());
    const open = await session(app);

    const rec = await mine("record_reading_session", { readerId: "judges", slug: "lion-and-mouse", wordsFollowed: 40 });
    expect(rec.data.readerId).toBe("judges");

    expect((await mine("get_reading_progress", { readerId: "judges" })).data.totalWordsRead).toBe(40);
    expect((await open("get_reading_progress", { readerId: "judges" })).data.totalWordsRead).toBe(0);

    await open("record_reading_session", { readerId: "judges", slug: "lion-and-mouse", wordsFollowed: 7 });
    expect((await open("get_reading_progress", { readerId: "judges" })).data.totalWordsRead).toBe(7);
    expect((await mine("get_reading_progress", { readerId: "judges" })).data.totalWordsRead).toBe(40);
  });

  it("refuses a malformed key rather than treating the caller as open", async () => {
    const { app } = buildServer({ contentDir: CONTENT_DIR });
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json", authorization: "Bearer nope" },
      payload: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "t", version: "1" } } },
    });
    expect(res.statusCode).toBe(401);
    expect(callerFrom(undefined)).toEqual({ space: null });
  });

  it("does not let an open reader name spell a keyed one", async () => {
    const { app } = buildServer({ contentDir: CONTENT_DIR });
    const open = await session(app);
    const res = await open("get_reading_progress", { readerId: "key:abc:judges" });
    expect(res.body.error?.message).toContain("colon");
  });
});
