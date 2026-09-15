import { useEffect, useMemo, useRef } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import {
  computeWordIndex,
  type CaptionDoc,
  type WordIndex,
} from "@everyword/captions-core";
import { globalWordPosition } from "./index";

/**
 * React Native variant of KaraokeCaptions, sharing all timing semantics
 * with the DOM component (same computeWordIndex, same globalWordPosition,
 * same onWordsRead contract). Nested Text styling carries the highlight;
 * colors come in as props because React Native has no CSS variables.
 *
 * This file is excluded from the package's tsc project (react-native is
 * an optional peer, typechecked inside the TV app); Metro compiles it in
 * the app that imports "karaoke-captions-react/native".
 */

export interface KaraokeCaptionsNativeProps {
  doc: CaptionDoc;
  time: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  highlightColor?: string;
  highlightInk?: string;
  doneInk?: string;
  upcomingInk?: string;
  onWordsRead?: (count: number) => void;
}

export function useWordIndex(doc: CaptionDoc, time: number): WordIndex {
  return useMemo(() => computeWordIndex(doc, time), [doc, time]);
}

export function KaraokeCaptionsNative({
  doc,
  time,
  style,
  textStyle,
  highlightColor = "#ffd34d",
  highlightInk = "#21242b",
  doneInk = "#f0f3f6",
  upcomingInk = "#9aa4af",
  onWordsRead,
}: KaraokeCaptionsNativeProps) {
  const wi = useWordIndex(doc, time);
  const lastPosition = useRef(0);

  useEffect(() => {
    if (!onWordsRead) return;
    const position = globalWordPosition(doc, wi);
    if (position > lastPosition.current) {
      onWordsRead(position - lastPosition.current);
    }
    lastPosition.current = position;
  }, [doc, wi, onWordsRead]);

  const segment = wi.segment >= 0 ? doc.segments[wi.segment] : undefined;

  return (
    <View style={style}>
      <Text style={[{ textAlign: "center", lineHeight: 64 }, textStyle]}>
        {segment
          ? segment.words.map((word, i) => {
              const state =
                i < wi.word ? "done" : i === wi.word ? "active" : "upcoming";
              return (
                <Text
                  key={`${segment.id}-${i}`}
                  style={
                    state === "active"
                      ? { backgroundColor: highlightColor, color: highlightInk }
                      : state === "done"
                        ? { color: doneInk }
                        : { color: upcomingInk, opacity: 0.7 }
                  }
                >
                  {word.w}
                  {i < segment.words.length - 1 ? " " : ""}
                </Text>
              );
            })
          : " "}
      </Text>
    </View>
  );
}
