import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

/**
 * Exactly one layer may answer for CORS.
 *
 * On Lambda this server sits behind a function URL whose own CORS
 * configuration already reflects the request origin. If the app registers
 * CORS as well, the response carries two `Access-Control-Allow-Origin`
 * headers and every browser rejects it outright, even when both values
 * are identical.
 *
 * This is the third appearance of the same bug across these projects.
 * Bellwether found it and filed it as friction entry 6. Nightlight then
 * shipped it, and its caregiver app could not load its own data in any
 * browser while curl reported a clean 200 throughout. Here it was live on
 * the deployed MCP endpoint, verified with a real request:
 *
 *   access-control-allow-origin: https://example.com
 *   access-control-allow-origin: https://example.com
 *
 * No command-line check catches it, which is exactly why it keeps
 * happening and why it is pinned here instead.
 */
describe("CORS is owned by one layer", () => {
  const saved = process.env.AWS_LAMBDA_FUNCTION_NAME;
  afterEach(() => {
    if (saved === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    else process.env.AWS_LAMBDA_FUNCTION_NAME = saved;
  });

  async function originHeaders(): Promise<string[]> {
    const { app } = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { origin: "https://example.com" },
    });
    const raw = res.headers["access-control-allow-origin"];
    await app.close();
    return raw === undefined ? [] : Array.isArray(raw) ? raw : [String(raw)];
  }

  it("sends no origin header of its own on Lambda", async () => {
    // The function URL adds it. Anything this app adds is the second copy.
    process.env.AWS_LAMBDA_FUNCTION_NAME = "everyword-mcp";
    expect(await originHeaders()).toEqual([]);
  });

  it("still answers browsers when there is no function URL in front", async () => {
    // Locally nothing else sets it, so the middleware is required.
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    expect(await originHeaders()).toEqual(["https://example.com"]);
  });

  it("never sends the header twice in either environment", async () => {
    for (const lambda of [true, false]) {
      if (lambda) process.env.AWS_LAMBDA_FUNCTION_NAME = "everyword-mcp";
      else delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      expect((await originHeaders()).length).toBeLessThanOrEqual(1);
    }
  });
});
