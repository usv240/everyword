/**
 * How somebody else puts these captions in their own app.
 *
 * The caption renderer is published on npm so that any video app can
 * adopt it, and the page never said so. A package nobody is told exists
 * has an audience of one.
 *
 * The snippet is copied from the package README, which is pinned by
 * packages/karaoke-captions-react/test/readme.test.ts. That test exists
 * because the README once documented a prop called `currentTime` when the
 * component's prop was `time`, which fails silently: the captions freeze
 * on the first word and nothing throws. What is shown here is what the
 * test guarantees.
 */

const WEB = `import { KaraokeCaptions } from "karaoke-captions-react";

<KaraokeCaptions doc={captionDoc} time={video.currentTime} />`;

const TV = `import { KaraokeCaptionsNative } from "karaoke-captions-react/native";

<KaraokeCaptionsNative doc={doc} time={position} highlightColor="#ffd34d" />`;

export function Developers() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h3 className="text-xl font-semibold tracking-tight text-ink">
        Put word-by-word captions in your own app
      </h3>
      <p className="mt-4 max-w-[680px] leading-relaxed text-muted">
        The renderer is its own package, MIT licensed and on npm. A caption
        document and a playback time go in; the current line comes out with
        the spoken word highlighted. The web reader above and the Fire TV
        app import the same package.
      </p>

      <pre className="mt-6 overflow-x-auto rounded-md border border-line bg-bg p-4 font-mono text-[12px] leading-relaxed text-ink">
        <code>npm install karaoke-captions-react</code>
      </pre>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* min-w-0: a grid item defaults to min-width:auto, so a code
            block wide enough to scroll makes the whole page scroll
            instead. On a phone that showed as the entire site
            sliding sideways. */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">In a browser</p>
          <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-ink">
            <code>{WEB}</code>
          </pre>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">On a TV, with React Native</p>
          <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-ink">
            <code>{TV}</code>
          </pre>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        <a
          className="text-[var(--primary)] underline underline-offset-2"
          href="https://www.npmjs.com/package/karaoke-captions-react"
          target="_blank"
          rel="noopener noreferrer"
        >
          karaoke-captions-react on npm
        </a>
        {" · "}
        <a
          className="text-[var(--primary)] underline underline-offset-2"
          href="https://www.npmjs.com/package/@everyword/captions-core"
          target="_blank"
          rel="noopener noreferrer"
        >
          @everyword/captions-core
        </a>
        {" · "}
        <a
          className="text-[var(--primary)] underline underline-offset-2"
          href="https://github.com/usv240/everyword/blob/main/docs/FORMAT.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          The caption format
        </a>
      </p>
    </div>
  );
}
