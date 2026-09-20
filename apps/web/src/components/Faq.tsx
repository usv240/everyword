/**
 * The questions a parent asks before they let this near their child.
 *
 * Both sibling projects carry an FAQ and this one did not, which left
 * the page answering every question except the ones a buyer has. The
 * answers here are deliberately the uncomfortable ones: what it does not
 * do, what it is not a substitute for, and where the evidence stops.
 *
 * Each answer is a fact from this repository rather than a position. If
 * one becomes untrue the fix is in the code, not in the copy.
 */

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: "Does it listen to my child?",
    a: (
      <>
        No, and it cannot. There is no microphone code anywhere in the web
        app, the TV app or the server. EveryWord reads aloud and follows
        its own cursor; it never needs to hear a child, so it was built
        without the ability to.
      </>
    ),
  },
  {
    q: "Will this teach my child to read?",
    a: (
      <>
        On its own, no, and anyone who tells you otherwise is selling
        something. Reading along with synchronised text and speech is a
        well-studied support for word recognition and fluency, and that is
        what EveryWord is: practice that happens during screen time a
        child was going to have anyway. It is not a curriculum, not a
        tutor, and not a replacement for reading with an adult.
      </>
    ),
  },
  {
    q: "How accurate is the highlighting?",
    a: (
      <>
        Measured rather than asserted. Against gold forced alignments, the
        end-to-end highlight lands at 30 ms median onset error, with no
        word lighting up more than 150 ms early across 766 matched words.
        The method and the raw numbers are in{" "}
        <code className="font-mono text-[12px]">docs/EVAL.md</code>. A word
        that lights up early is worse than one that lights up late,
        because it tells a child the wrong word is being spoken, which is
        why that number is reported separately.
      </>
    ),
  },
  {
    q: "Has it run on a real Fire TV?",
    a: (
      <>
        Not yet, and the status list above says so rather than implying
        otherwise. The app is built for Fire OS as a multi-architecture
        APK and has run on Amazon&apos;s documented Android TV virtual
        device. Fire OS differs from stock Android TV, most of all in
        WebView behaviour, and EveryWord renders captions in native views
        rather than a WebView, which is the area of largest known
        divergence. It would not go to the Amazon Appstore until it had
        run on hardware.
      </>
    ),
  },
  {
    q: "What does it cost to run?",
    a: (
      <>
        The expensive part happens once. Speech and word timings are
        generated per story, not per child and not per play, so a story
        costs what it costs the first time and nothing after that. The
        reading itself is a static file and a cursor.
      </>
    ),
  },
  {
    q: "Can I use it without Alexa or a Fire TV?",
    a: (
      <>
        Yes. The reader above is the whole product and it runs in this
        browser. Fire TV is where it belongs in a living room, and the
        MCP server is how an assistant reaches it, but neither is required
        to read a story.
      </>
    ),
  },
  {
    q: "Where do the stories come from?",
    a: (
      <>
        Aesop, who has been in the public domain for roughly two and a half
        thousand years. Nothing here uses copyrighted text, and the
        library is a file in the repository you can read.
      </>
    ),
  },
];

export function Faq() {
  return (
    <div className="max-w-[820px] space-y-3">
      {QA.map(({ q, a }) => (
        <details
          key={q}
          className="group rounded-[var(--radius-md)] border border-line bg-surface p-5"
        >
          <summary className="cursor-pointer list-none font-medium text-ink marker:content-none">
            {q}
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
