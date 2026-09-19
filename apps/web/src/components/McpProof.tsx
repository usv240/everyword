"use client";

import { useState } from "react";

/**
 * The Alexa+ integration, shown rather than claimed.
 *
 * The Alexa+ track asks for a self-hosted MCP server on spec 2025-11-25
 * over Streamable HTTP. EveryWord has one, deployed and conformance
 * tested, and until this panel a visitor had no way to see it: the page
 * was a reader and nothing else. A server nobody can watch answer is
 * indistinguishable from one that does not exist.
 *
 * One press runs a complete MCP session from this browser against the
 * live endpoint, exactly as an agent would: agree a protocol version,
 * finish the handshake, ask what tools exist, call one, and close the
 * session. Every row is the server's own answer.
 *
 * Nothing here is sandboxed or simulated. The recommendation is the real
 * tool choosing from the real library, which is why the reason it gives
 * is worth showing rather than only the title.
 */

export const MCP_URL = (
  process.env.NEXT_PUBLIC_MCP_URL ??
  "https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp"
).replace(/\/$/, "");

const PROTOCOL = "2025-11-25";

interface Step {
  label: string;
  request: string;
  status: number;
  ok: boolean;
  shows: string;
}

interface Pick {
  title: string;
  durationSeconds: number;
  reason: string;
}

async function rpc(
  body: object,
  session?: string,
): Promise<{ status: number; session: string | null; json: unknown }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (session) {
    headers["mcp-session-id"] = session;
    headers["mcp-protocol-version"] = PROTOCOL;
  }
  const res = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, session: res.headers.get("mcp-session-id"), json };
}

/** Short enough to read on screen, honest about being an excerpt. */
function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

const soft = (token: string) => `color-mix(in srgb, var(${token}) 14%, transparent)`;
const DANGER = "#b3261e";

export function McpProof() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [pick, setPick] = useState<Pick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ms, setMs] = useState(0);

  const run = async () => {
    setState("running");
    setSteps([]);
    setPick(null);
    setError(null);
    const started = performance.now();
    const out: Step[] = [];
    const push = (s: Step) => {
      out.push(s);
      setSteps([...out]);
    };

    try {
      // 1. Agree a protocol version and open a session.
      const init = await rpc({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL,
          capabilities: {},
          clientInfo: { name: "everyword-site", version: "1" },
        },
      });
      const session = init.session;
      const agreed = (init.json as { result?: { protocolVersion?: string } })?.result
        ?.protocolVersion;
      if (!session || agreed !== PROTOCOL) {
        throw new Error(
          `the server did not open a ${PROTOCOL} session (status ${init.status})`,
        );
      }
      push({
        label: "Agree a protocol and open a session",
        request: "initialize",
        status: init.status,
        ok: true,
        shows: `protocol ${agreed}, session ${shortId(session)}`,
      });

      // 2. Finish the handshake. A notification, so 202 and no body.
      const ready = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, session);
      push({
        label: "Finish the handshake",
        request: "notifications/initialized",
        status: ready.status,
        ok: ready.status === 202,
        shows: "accepted, no body, as the spec requires for a notification",
      });

      // 3. What can an agent do here?
      const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, session);
      const tools =
        (list.json as { result?: { tools?: { name: string }[] } })?.result?.tools?.map(
          (t) => t.name,
        ) ?? [];
      push({
        label: "Ask what an agent can do",
        request: "tools/list",
        status: list.status,
        ok: tools.length > 0,
        shows: `${tools.length} tools: ${tools.join(", ")}`,
      });

      // 4. Do one of them, the way an agent answering a parent would.
      const call = await rpc(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "recommend_story", arguments: { maxMinutes: 5 } },
        },
        session,
      );
      const text =
        (call.json as { result?: { content?: { text?: string }[] } })?.result?.content?.[0]
          ?.text ?? "";
      let chosen: Pick | null = null;
      try {
        const parsed = JSON.parse(text) as {
          pick?: { title: string; durationSeconds: number };
          reason?: string;
        };
        if (parsed.pick) {
          chosen = {
            title: parsed.pick.title,
            durationSeconds: parsed.pick.durationSeconds,
            reason: parsed.reason ?? "",
          };
        }
      } catch {
        chosen = null;
      }
      push({
        label: "Ask for something short before bed",
        request: "tools/call recommend_story { maxMinutes: 5 }",
        status: call.status,
        ok: chosen !== null,
        shows: chosen ? `${chosen.title}, ${chosen.durationSeconds} seconds` : "no pick returned",
      });
      setPick(chosen);

      // 5. Close the session, which is the part most servers forget.
      const end = await fetch(MCP_URL, {
        method: "DELETE",
        headers: { "mcp-session-id": session },
      });
      push({
        label: "Close the session",
        request: "DELETE",
        status: end.status,
        ok: end.status === 200 || end.status === 204,
        shows: "session ended on the server",
      });

      setMs(Math.round(performance.now() - started));
      setState("done");
    } catch (err) {
      // A proof that fails must read as a failure, never as a half-filled
      // table a viewer might take for success.
      setError((err as Error).message);
      setState("error");
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]"
          style={{ background: soft("--primary") }}
        >
          MCP 2025-11-25
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-ink">
          A live session with the reading agent
        </h3>
      </div>

      <p className="mt-4 max-w-[680px] leading-relaxed text-muted">
        Alexa+ talks to tools through the Model Context Protocol. Press this
        and your browser will hold a complete session with EveryWord&apos;s
        server, the way an assistant would when a parent asks for a story.
        Every row below is the server&apos;s own answer.
      </p>

      <button
        type="button"
        onClick={() => void run()}
        disabled={state === "running"}
        className="mt-6 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-medium text-[var(--primary-contrast)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "running"
          ? "Talking to the server..."
          : state === "idle"
            ? "Start a session"
            : "Run it again"}
      </button>

      <div aria-live="polite">
        {state === "error" && (
          <p
            className="mt-6 rounded-lg border p-4 text-sm"
            style={{ borderColor: DANGER, color: DANGER, background: `color-mix(in srgb, ${DANGER} 10%, transparent)` }}
          >
            The live server could not be reached: {error}. Nothing is being
            shown in its place.
          </p>
        )}

        {steps.length > 0 && (
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li key={s.request} className="rounded-lg border border-line bg-bg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-medium text-ink">
                    <span className="mr-2 font-mono text-sm text-muted">{i + 1}</span>
                    {s.label}
                  </p>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                    style={
                      s.ok
                        ? { background: soft("--success"), color: "var(--success)" }
                        : { background: `color-mix(in srgb, ${DANGER} 12%, transparent)`, color: DANGER }
                    }
                  >
                    {s.status} {s.ok ? "OK" : "Unexpected"}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[12px] text-muted">{s.request}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.shows}</p>
              </li>
            ))}
          </ol>
        )}

        {state === "done" && pick && (
          <div className="mt-6 rounded-lg border border-line bg-bg p-5">
            <p className="text-sm text-muted">What the agent would read tonight</p>
            <p className="mt-1 text-lg font-semibold text-ink">{pick.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{pick.reason}</p>
          </div>
        )}

        {state === "done" && (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Five requests, one session, {ms}ms, from this browser to the deployed
            server. The endpoint is open to any MCP client:{" "}
            <code className="break-all rounded bg-bg px-1.5 py-0.5 font-mono text-[12px]">
              {MCP_URL}
            </code>
          </p>
        )}
      </div>
    </div>
  );
}
