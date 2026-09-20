/**
 * EveryWord on the television, and how a family gets it there.
 *
 * Fire TV is this project's primary track and the page never mentioned
 * it. A visitor could read along in the browser and would leave with no
 * idea there was a TV app, what it looked like, or how to put it on their
 * own Fire TV. An app nobody can find the install steps for is not
 * something anybody else can use.
 *
 * The status list at the bottom is the honest part. The APK is built for
 * Fire OS and published, and it has been run on an Android TV virtual
 * device, which is Amazon's own documented way to emulate one. It has not
 * yet been run on physical Fire TV hardware, and the page says so rather
 * than letting a green badge imply it. docs/FIRE_TV_TARGET.md carries the
 * full argument, including why Vega OS was not a reachable target from
 * Windows.
 */

export const APK_URL =
  "https://github.com/usv240/everyword/releases/download/v0.2.0/everyword-tv-v0.2.0.apk";

const soft = (token: string) => `color-mix(in srgb, var(${token}) 14%, transparent)`;
const PENDING = "#9a6700";

const STEPS: { title: string; body: string; code?: string }[] = [
  {
    title: "Let the Fire TV accept an app you install yourself",
    body: "On the TV: Settings, My Fire TV, Developer options. Turn on ADB debugging and Apps from unknown sources. If Developer options is missing, open About and select the device name seven times.",
  },
  {
    title: "Find the TV on your network",
    body: "Settings, My Fire TV, About, Network. Note the IP address.",
  },
  {
    title: "Install EveryWord from a computer on the same network",
    body: "Download the APK below, then:",
    code: "adb connect 192.168.1.20\nadb install everyword-tv-v0.2.0.apk",
  },
  {
    title: "Open it from the Fire TV home screen",
    body: "EveryWord appears under Your Apps. The remote is the whole interface: every control is reachable with the D-pad, and focus is always visible.",
  },
];

const STATUS: { what: string; done: boolean }[] = [
  { what: "Built for Fire OS as a multi-architecture APK, published", done: true },
  { what: "Whole library on the TV, D-pad and remote media keys, progress reported to the MCP server", done: true },
  { what: "Run on an Android TV virtual device, Amazon's documented emulator path", done: true },
  { what: "Run on physical Fire TV hardware", done: false },
];

export function FireTv() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]"
          style={{ background: soft("--primary") }}
        >
          Fire OS
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-ink">
          The same reader, ten feet from the screen
        </h3>
      </div>

      <p className="mt-4 max-w-[680px] leading-relaxed text-muted">
        Children watch television. EveryWord turns that screen into reading
        practice with the same captions you can try above, rebuilt for the
        living room: large type, a remote instead of a mouse, and a focus
        ring you can always see from the sofa.
      </p>

      <figure className="mt-6 overflow-hidden rounded-lg border border-line">
        <picture>
          <source srcSet="/tv-release-karaoke.webp" type="image/webp" />
          <img
            src="/tv-release-karaoke.png"
            alt="The EveryWord TV app mid-story. The word care is highlighted yellow as it is spoken, and the Read that line again button carries the D-pad focus ring."
            width={1920}
            height={1080}
            className="block h-auto w-full"
            loading="lazy"
          />
        </picture>
        <figcaption className="border-t border-line bg-bg px-4 py-3 text-xs leading-relaxed text-muted">
          The release APK, driven by D-pad only. The yellow ring is focus,
          on &ldquo;Read that line again&rdquo;.
        </figcaption>
      </figure>

      <figure className="mt-4 overflow-hidden rounded-lg border border-line">
        <picture>
          <source srcSet="/tv-library.webp" type="image/webp" />
          <img
            src="/tv-library.png"
            alt="The EveryWord TV library. Five story cards in a row; the first carries the D-pad focus ring, and The Hare and the Tortoise shows 113 read."
            width={1920}
            height={1080}
            className="block h-auto w-full"
            loading="lazy"
          />
        </picture>
        <figcaption className="border-t border-line bg-bg px-4 py-3 text-xs leading-relaxed text-muted">
          The whole library on the television, chosen with the D-pad. Every
          word count is computed from the caption document that drives the
          highlight, so the number on the card is the number the cursor
          counts. &ldquo;113 read&rdquo; is the session in the panel below,
          reported by the TV and read back from the MCP server.
        </figcaption>
      </figure>

      <div className="mt-8 rounded-lg border border-line bg-bg p-5">
        <h4 className="font-semibold text-ink">
          The television is a client of the same MCP server Alexa+ uses
        </h4>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink">
            record_reading_session
          </code>{" "}
          describes itself, in the tool list the deployed server hands to
          any assistant, as the thing the player calls as the karaoke
          cursor advances. For a while no player called it, so the only
          progress an assistant could read was progress an assistant had
          written. Fire TV and Alexa+ were two products sharing a package.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Now the TV app opens a session against the same public endpoint,
          over the same Streamable HTTP transport, with no shared secret
          and no private back door, and reports the words the cursor
          actually passed. Ask Alexa+ how far a child got and the answer
          comes off the television. If the network is gone the reader keeps
          working and the row is simply lost; a child in a living room
          never sees an error.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-bg p-5">
        <h4 className="font-semibold text-ink">What the remote does</h4>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Not just the on-screen buttons. A Fire TV remote sends real media
          keys, and the first version of this app ignored every one of
          them, which reads as broken from a sofa. Play/Pause starts and
          stops, rewind and fast-forward move five seconds, and Back
          returns to the library rather than leaving the app mid-story.
          Everything is reachable with the D-pad alone and focus is always
          visible.
        </p>
      </div>

      <h4 className="mt-8 font-semibold text-ink">Put it on your own Fire TV</h4>
      <ol className="mt-4 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-lg border border-line bg-bg p-4">
            <p className="font-medium text-ink">
              <span className="mr-2 font-mono text-sm text-muted">{i + 1}</span>
              {s.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            {s.code && (
              <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-surface p-3 font-mono text-[12px] leading-relaxed text-ink">
                <code>{s.code}</code>
              </pre>
            )}
          </li>
        ))}
      </ol>

      <a
        href={APK_URL}
        className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-medium text-[var(--primary-contrast)] transition-opacity hover:opacity-90"
      >
        Download the APK (40 MB)
      </a>

      {/*
        Stated plainly rather than implied by the green badges above it. A
        reader who works out for themselves that this never ran on a real
        Fire TV is right to distrust everything else on the page.
      */}
      <div className="mt-8 border-t border-line pt-6">
        <h4 className="font-semibold text-ink">Where this actually stands</h4>
        <ul className="mt-4 space-y-2">
          {STATUS.map((s) => (
            <li key={s.what} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
              <span
                className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={
                  s.done
                    ? { background: soft("--success"), color: "var(--success)" }
                    : { background: `color-mix(in srgb, ${PENDING} 14%, transparent)`, color: PENDING }
                }
              >
                {s.done ? "Done" : "Not yet"}
              </span>
              <span>{s.what}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Fire OS differs from stock Android TV, most of all in WebView. The
          TV app renders captions in native views rather than a WebView,
          which is where the known differences are largest, but it has not
          been submitted to the Amazon Appstore and will not be until it has
          run on real hardware.{" "}
          <a
            className="text-[var(--primary)] underline underline-offset-2"
            href="https://github.com/usv240/everyword/blob/main/docs/FIRE_TV_TARGET.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            The full target and test record
          </a>
        </p>
      </div>
    </div>
  );
}
