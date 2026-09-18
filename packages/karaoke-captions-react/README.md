# karaoke-captions-react

Captions that light up word by word as they are spoken, for React and React Native.

MIT. Node 18+, React 18+.

```
npm install karaoke-captions-react @everyword/captions-core
```

## Why word-by-word

Same Language Subtitling puts karaoke-style captions in the viewer's own language on ordinary entertainment. It has been running on Indian national television for two decades and is national broadcast policy there. A five-year study of 13,000 people who could initially read little or nothing found 32 percentage points more children becoming good readers than in the unexposed group, at about $0.004 per learner.

Amazon ships the same mechanic for books, as Immersion Reading. No video platform ships it. This component is the renderer that is missing.

## Use

```tsx
import { KaraokeCaptions } from "karaoke-captions-react";

<KaraokeCaptions doc={captionDoc} time={video.currentTime} />
```

`doc` is a word-timed caption document from [`@everyword/captions-core`](https://www.npmjs.com/package/@everyword/captions-core), which also normalizes Amazon Transcribe output into that shape. `time` is seconds, straight off your media element. Drive it from `requestAnimationFrame` or a `timeupdate` handler; the lookup is a binary search over a prebuilt index and allocates nothing per frame.

## Theming

Four CSS variables, so it inherits your design rather than imposing one.

```css
.captions {
  --kc-highlight: #ffd34d;      /* background behind the word being spoken */
  --kc-highlight-ink: #21242b;  /* that word's text colour */
  --kc-done-ink: inherit;       /* words already spoken */
  --kc-upcoming-ink: inherit;   /* words not yet spoken, also dimmed to 0.55 */
}
```

Pass your own class with `className`. Nothing else is styled for you.

Words carry `data-state="done" | "active" | "upcoming"`, so you can target them directly if the variables are not enough.

## React Native and Fire TV

```tsx
import { KaraokeCaptionsNative } from "karaoke-captions-react/native";
```

The native entry ships as TypeScript source rather than compiled JavaScript, because it imports `react-native` and is built by your own Metro transform. Every React Native project already does that transform, so no configuration is needed. `react-native` is an optional peer dependency: install it only if you use this entry.

Same component, same document. React Native has no CSS variables, so colours are props instead:

```tsx
<KaraokeCaptionsNative
  doc={doc}
  time={position}
  style={styles.captionBox}
  textStyle={styles.captionText}
  highlightColor="#ffd34d"
  highlightInk="#21242b"
/>
```

It runs on a Fire TV in a ten-foot layout.

## Never early

The rule the renderer enforces: a word may light late, never early. A highlight that runs ahead of the voice teaches a learning reader that a sound belongs to the next word, which is worse than no highlight at all.

Measured end to end against gold Montreal Forced Aligner alignments on LibriSpeech, on the clean split and again on the split the corpus itself labels hard: 30 ms median onset error on both, and zero words lit early beyond 150 ms across 766 and 761 matched words respectively. Method and reproduction in [EVAL.md](https://github.com/usv240/everyword/blob/main/docs/EVAL.md).

## API

- `<KaraokeCaptions doc time className? onWordsRead? />` the web renderer
- `<KaraokeCaptionsNative doc time style? textStyle? highlightColor? highlightInk? doneInk? upcomingInk? onWordsRead? />` from `karaoke-captions-react/native`
- `useWordIndex(doc, time): WordIndex` the memoised cursor lookup, if you want to drive something else with it
- `globalWordPosition(doc, wordIndex): number` how many words have been read at that cursor position

`onWordsRead(count)` fires when the highlight advances, with the number of words completed since the last call. Seeking backward never emits a negative count. It is what drives a reading-exposure meter.

## License

MIT.
