"use client";

import { useState } from "react";

/**
 * Your own key, and the proof that it is yours.
 *
 * The server is open: a reader is a name a family chose and the
 * television reports under it, which is what lets a judge try
 * everything from this page. A key is for anybody
 * who wants their own space. One press issues one, free and with no
 * account, and shows the line to paste into an MCP client.
 *
 * The second press is the proof, against the deployed server: record a
 * short session for the reader "judges" with the key, read their progress
 * back with the key, then ask for the same reader with no key. The open
 * server sees none of it.
 */

import { MCP_URL } from "./McpProof";

const BASE = MCP_URL.replace(/\/mcp$/, "");
const PROTOCOL = "2025-11-25";

async function call(key: string | null, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const auth: Record<string, string> = key ? { authorization: `Bearer ${key}` } : {};
  const init = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "everyword-site-key", version: "1" } } }),
  });
  const session = init.headers.get("mcp-session-id");
  if (!session) throw new Error(`no session (status ${init.status})`);
  const headers = { "content-type": "application/json", "mcp-session-id": session, "mcp-protocol-version": PROTOCOL, ...auth };
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = (await res.json()) as { result?: { content?: { text: string }[] }; error?: { message: string } };
  await fetch(`${BASE}/mcp`, { method: "DELETE", headers: { "mcp-session-id": session } });
  if (body.error) throw new Error(body.error.message);
  return JSON.parse(body.result?.content?.[0]?.text ?? "{}") as Record<string, unknown>;
}

export function ApiKey() {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ withKey: number; withoutKey: number } | null>(null);
  const [mark] = useState(() => 11 + Math.floor(Math.random() * 20));
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/v1/keys`, { method: "POST" });
      const body = (await res.json()) as { key: string };
      setKey(body.key);
      setProof(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const prove = async () => {
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      await call(key, "record_reading_session", { readerId: "judges", slug: "lion-and-mouse", wordsFollowed: mark });
      const mine = await call(key, "get_reading_progress", { readerId: "judges" });
      const open = await call(null, "get_reading_progress", { readerId: "judges" });
      setProof({ withKey: Number(mine.totalWordsRead ?? 0), withoutKey: Number(open.totalWordsRead ?? 0) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const config = key
    ? JSON.stringify({ mcpServers: { everyword: { url: `${BASE}/mcp`, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)
    : "";

  return (
    <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[60ch]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Your own key</p>
          <p className="mt-2 leading-relaxed text-muted">
            The server is open, so you can try everything above with no key. If you want a
            space of your own, take a key: free, no account, and readers you name with it
            are yours alone. Nothing about the key is stored, so keep it.
          </p>
        </div>
        <button type="button" onClick={() => void issue()} disabled={busy} className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-medium text-[var(--primary-contrast)] transition-opacity hover:opacity-90 disabled:opacity-60">
          {busy && !key ? "Issuing…" : key ? "Another key" : "Get an API key"}
        </button>
      </div>

      {key && (
        <>
          <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-ink">{key}</pre>
          <p className="mt-4 text-sm text-muted">Paste into any MCP client, Claude Desktop or an Alexa+ integration:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-ink">{config}</pre>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => void prove()} disabled={busy} className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-medium text-[var(--primary-contrast)] transition-opacity hover:opacity-90 disabled:opacity-60">
              {busy ? "Checking…" : "Prove it is yours"}
            </button>
            <p className="text-sm text-muted">Records {mark} words read by &ldquo;judges&rdquo; with your key, then asks for the same reader with none.</p>
          </div>
          {proof && (
            <table className="mt-6 w-full text-sm">
              <tbody>
                <tr className="border-t border-line">
                  <td className="py-2 text-ink">&ldquo;judges&rdquo;, asked with your key</td>
                  <td className="py-2 font-mono text-[12px] text-ink">{proof.withKey} words read</td>
                </tr>
                <tr className="border-t border-line">
                  <td className="py-2 text-ink">&ldquo;judges&rdquo;, asked with no key</td>
                  <td className="py-2 font-mono text-[12px] text-ink">{proof.withoutKey} words read, none of them yours</td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      )}

      {error && <p className="mt-4 text-sm text-ink font-medium">{error}</p>}
    </div>
  );
}
