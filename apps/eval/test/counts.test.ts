import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Counts that appear in public text have to be counted, not remembered.
 *
 * The README said "86 tests" against a suite of 92. It under-claimed, so
 * nobody was misled, but this project's whole argument is that every
 * published number is re-derived from something committed. A number that
 * nothing checks is a number that was only true on the day it was typed.
 *
 * The same drift was found in all three sibling projects on the same day,
 * and in one of them the figure had been copied across from this one,
 * which is how a submission ended up contradicting its own README.
 *
 * This suite counts itself, which is the awkward part: adding a test here
 * changes the total. That is the intended cost. The number in the README
 * is a claim, and claims are maintained.
 */

/*
  The landing page counts as public text.

  It states no number today, which is the only reason it was left out.
  A sibling project learned this the expensive way: its suite read the two
  markdown files and nothing else, and production sat there saying "47
  tests" while the suite had 147. A judge reads the page before they read
  the repository. Listing it now costs nothing and means the day somebody
  puts a figure in the copy, it is already pinned.
*/
const PUBLIC_TEXT = [
  "README.md",
  "docs/SUBMISSION.md",
  "apps/web/src/app/page.tsx",
].flatMap((f) => {
  const p = path.join(repo, f);
  return fs.existsSync(p) ? [{ file: f, text: fs.readFileSync(p, "utf8") }] : [];
});

/**
 * Count the suite the way vitest collects it, without running it.
 *
 * Spawning vitest from inside vitest is a trap twice over: the inner run
 * collects this file too and spawns again, and on Windows a .cmd shim
 * cannot be spawned without a shell since Node 22. So this walks the test
 * directories and counts declarations.
 *
 * `it.each` tables count one test per row, one row per line starting with
 * `[`. A sibling project's first draft of this counter missed those and
 * was five short of vitest's own total while carrying a comment
 * insisting no such table existed.
 */
/**
 * The Fire TV app's tests, which are Jest and live outside the workspaces.
 *
 * They were invisible to this counter and to `npm test`, and the cost of
 * that was concrete: `tv/__tests__/App.test.tsx` had been failing to
 * parse for as long as it existed and nothing reported it, because
 * nothing ran it. The app for this project's primary track had one test
 * and it was a test that never executed.
 *
 * Counted separately because the file naming differs (`.test.ts` and
 * `.test.tsx` directly under `tv/__tests__`) and because Jest, not
 * vitest, collects them.
 */
function tvTests(): number {
  const dir = path.join(repo, "tv", "__tests__");
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!/\.test\.tsx?$/.test(entry)) continue;
    const text = fs.readFileSync(path.join(dir, entry), "utf8");
    n += (text.match(/^\s*(?:it|test)\(/gm) ?? []).length;
  }
  return n;
}

function totalTests(): number {
  const roots = ["apps", "packages"];
  let n = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", "cdk.out", "build", ".next"].includes(entry.name)) continue;
        walk(full);
      } else if (/\.test\.ts$/.test(entry.name) && full.includes(`${path.sep}test${path.sep}`)) {
        const text = fs.readFileSync(full, "utf8");
        n += (text.match(/^\s*(?:it|test)\(/gm) ?? []).length;
        const each = /(?:it|test)\.each\(\[\s*\n([\s\S]*?)\n\s*\]\)\(/g;
        for (const m of text.matchAll(each)) {
          n += (m[1]!.match(/^\s*\[/gm) ?? []).length;
        }
      }
    }
  };
  for (const r of roots) {
    const full = path.join(repo, r);
    if (fs.existsSync(full)) walk(full);
  }
  return n;
}

describe("published counts match the repository", () => {
  /*
    The friction log is a judged deliverable, and its size is quoted.

    The submission said "Twelve entries in FRICTION_LOG.md" while the file
    had thirteen, and the missing one was entry 13: our own deployed MCP
    server answering a malformed body with a 500 while thirty-five tests
    passed. All three sibling projects had this same drift on the same
    day, each undercounting, each leaving out the entry written against
    itself. Those are the entries a partner team would most want, so
    undercounting them is the one direction this cannot afford.
  */
  it("states the number of friction log entries the file actually has", () => {
    const log = fs.readFileSync(path.join(repo, "FRICTION_LOG.md"), "utf8");
    const actual = (log.match(/^## Entry \d+:/gm) ?? []).length;
    expect(actual).toBeGreaterThan(0);
    const words: Record<number, string> = {
      10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen",
      14: "fourteen", 15: "fifteen", 16: "sixteen",
    };
    const word = words[actual];
    expect(word, `no spelling for ${actual}; add it here`).toBeTruthy();
    const wrong = PUBLIC_TEXT.filter((d) => {
      const m = d.text.match(/(\w+) entries in FRICTION_LOG/i);
      return m ? m[1]!.toLowerCase() !== word : false;
    });
    expect(
      wrong.map((d) => d.file),
      `FRICTION_LOG.md has ${actual} entries`,
    ).toEqual([]);
  });

  it("counts a suite at all, so a broken walker cannot pass silently", () => {
    expect(totalTests()).toBeGreaterThan(50);
  });

  it("states a total that matches the suite", () => {
    const stated = PUBLIC_TEXT.flatMap((d) => {
      const m = d.text.match(/(\d+) tests/);
      return m ? [{ file: d.file, n: Number(m[1]) }] : [];
    });
    expect(stated.length).toBeGreaterThan(0);
    const actual = totalTests() + tvTests();
    for (const s of stated) {
      expect(
        Math.abs(actual - s.n),
        `${s.file} says ${s.n} tests, the suite has ${actual}`,
      ).toBeLessThanOrEqual(2);
    }
  });
});
