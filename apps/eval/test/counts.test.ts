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

/*
  A hint that names a key the code does not handle.

  This is the same defect as a library caption reading "Five
  public-domain fables" above six titles, and as a story card that
  credited Amazon Transcribe for subtitles the film already shipped
  with: copy describing behaviour that is not there. Here it costs more
  than it looks, because the person the hint is written for is somebody
  who cannot reliably read the sentence that explains the workaround.
*/
describe("the keyboard hint on the reader", () => {
  const page = fs.readFileSync(path.join(repo, "apps/web/src/app/page.tsx"), "utf8");

  /** The keys the page puts in front of a visitor. */
  const advertised = [...page.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]!.trim());

  /** What the handler actually compares KeyboardEvent.key against. */
  const handled = [...page.matchAll(/e\.key === "([^"]+)"/g)].map((m) => m[1]!);

  const SPELLING: Record<string, string[]> = {
    space: [" ", "Spacebar"],
    "left arrow": ["ArrowLeft"],
    S: ["s", "S"],
  };

  it("advertises keys at all, so a broken match cannot pass silently", () => {
    expect(advertised.length).toBeGreaterThan(0);
    expect(handled.length).toBeGreaterThan(0);
  });

  it("handles every key it tells a visitor to press", () => {
    for (const label of advertised) {
      const keys = SPELLING[label];
      expect(keys, `the page offers "${label}"; add its KeyboardEvent.key here`).toBeTruthy();
      expect(
        keys!.some((k) => handled.includes(k)),
        `the page says to press "${label}" and nothing handles it`,
      ).toBe(true);
    }
  });

  it("names controls that exist, in the hint it gives touch visitors", () => {
    // A phone has no space bar, so it gets a different sentence, and that
    // sentence points at buttons by name. Rename a button and the hint
    // starts describing something the visitor cannot find.
    const hint = page.match(/ew-touch-only[\s\S]*?<\/p>/)?.[0] ?? "";
    expect(hint, "no touch hint found on the reader").toBeTruthy();
    const buttons = [...page.matchAll(/<button[\s\S]*?<\/button>/g)]
      // The markup is wrapped across lines, so the label is not sitting
      // flush against its tags in the source. Collapse before looking.
      .map((m) => m[0].replace(/\s+/g, " ").replace(/>\s+/g, ">").replace(/\s+</g, "<"))
      .join(" ");
    for (const label of ["Play", "Read that line again"]) {
      if (!hint.includes(label)) continue;
      expect(
        buttons.includes(`>${label}<`) || buttons.includes(`"${label}"`),
        `the touch hint says to tap "${label}" and no button is called that`,
      ).toBe(true);
    }
  });

  it("leaves a key pressed inside a control to that control", () => {
    // Space already activates a focused button. Without this guard every
    // button on the page fires twice, so the reader starts playing at the
    // moment somebody pressed Pause.
    expect(page).toMatch(/closest\(\s*"button,/);
  });
});

/*
  The published figure counts tests that the documented command has to be
  able to reach.

  A clean clone ran `npm install` and `npm test`, watched vitest go green
  on 132, and then fell over on a missing jest: the Fire TV app keeps its
  own node_modules outside the workspaces, and nothing installed it. So
  the suite on this project's primary track had never run for anybody who
  did not already have the repository working, while the README counted
  those tests in its headline.

  That is the same shape as a guard that skips instead of failing. The
  green came from the part that ran.
*/
describe("the documented command can reach the number it claims", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repo, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };

  it("runs the Fire TV suite from npm test", () => {
    expect(pkg.scripts.test).toContain("--prefix tv");
  });

  it("installs the Fire TV app's own dependencies from npm install", () => {
    const install = [pkg.scripts.postinstall, pkg.scripts.prepare]
      .filter(Boolean)
      .join(" ");
    expect(
      install,
      "nothing installs tv/, so a clean clone cannot run the suite the README counts",
    ).toContain("tv");
  });
});
