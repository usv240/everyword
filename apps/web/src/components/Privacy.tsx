/**
 * What EveryWord knows about a child, which is very little.
 *
 * Every other section of this page was about what the product does. This
 * one is about what it does not do, and it was the conspicuous hole: the
 * two sibling projects both carry a section like this, and they are for
 * adults. This is the one used by children, and it said nothing at all
 * about their data.
 *
 * The strongest fact here was also the least advertised. EveryWord has
 * no microphone. There is no `getUserMedia`, no `MediaRecorder` and no
 * `AudioRecord` anywhere in the web app, the TV app or the server, so
 * the question a parent actually asks, whether the thing in the living
 * room is listening to their child, has a one-word answer rather than a
 * policy. Amazon Transcribe appears in this project only offline, to
 * measure our own highlight timing against gold alignments, and never on
 * a reader.
 *
 * The row list is the literal shape written by `record_reading_session`
 * in apps/mcp/src/mcp.ts. If that shape changes, this must change with
 * it, which is why the fields are named rather than summarised.
 */

const KEPT = [
  { field: "readerId", plain: "whichever name the household chose, which need not be the child's" },
  { field: "slug", plain: "which story, by its short name" },
  { field: "wordsFollowed", plain: "how many words the cursor actually reached" },
  { field: "completed", plain: "whether they got to the end" },
  { field: "at", plain: "when" },
];

const NEVER = [
  "Audio of any kind. There is no microphone in the web app, the TV app or the server.",
  "Video, or a camera of any kind.",
  "A child's name, age, school, or anything that identifies them, unless a parent types one into readerId.",
  "What they said, because nothing here ever listens.",
  "A reading level, a score, or a judgement about the child.",
];

export function Privacy() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 sm:p-8">
      <p className="max-w-[720px] leading-relaxed text-muted">
        This is a product for children, so the honest answer about their
        data should be short enough to read in full. It is five fields.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-line bg-bg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">
            Everything a session records
          </h3>
          <ul className="mt-4 space-y-3">
            {KEPT.map((k) => (
              <li key={k.field} className="text-sm leading-relaxed text-muted">
                <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink">
                  {k.field}
                </code>
                <span className="ml-2">{k.plain}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            That is the whole row. You can read the code that writes it in{" "}
            <code className="font-mono text-[12px]">apps/mcp/src/mcp.ts</code>.
          </p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-line bg-bg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">
            What it never has
          </h3>
          <ul className="mt-4 space-y-3">
            {NEVER.map((n) => (
              <li key={n} className="flex gap-2 text-sm leading-relaxed text-muted">
                <span aria-hidden className="mt-[2px] shrink-0 font-semibold text-ink">
                  &minus;
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 max-w-[760px] text-sm leading-relaxed text-muted">
        The reason is structural rather than a promise. EveryWord reads{" "}
        <em>to</em> a child and watches where its own cursor got to. It
        never needs to hear them, so it was built without the ability to.
        A product that cannot listen cannot leak what it heard.
      </p>
    </div>
  );
}
