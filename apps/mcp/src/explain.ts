import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import type { Story } from "./library";

/**
 * Explaining a word to someone who is learning to read.
 *
 * This is the one place in EveryWord where a language model touches what a
 * reader sees, and it is deliberately fenced in:
 *
 * 1. The word must actually appear in the story. We check that against the
 *    caption document before calling anything, so the model can never be
 *    asked to explain a word the reader did not encounter, and a typo gets
 *    an honest "that word is not in this story" rather than a confident
 *    definition of something else.
 * 2. The sentence the word appeared in is supplied as context, because
 *    "pitcher" in a fable about a crow is not the one in a baseball game.
 * 3. The model is asked for one short sentence at a reading level below the
 *    word itself. A definition a struggling reader cannot read is not a
 *    definition.
 * 4. Every rung of the model ladder is tried, and if all of them fail the
 *    tool returns the sentence the word appeared in and says plainly that no
 *    explanation is available. Showing the reader their own context is a
 *    genuinely useful floor, and it is never wrong.
 *
 * The karaoke timing path never touches a model. That boundary does not move
 * because this feature exists.
 */

const DEFAULT_LADDER = [
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  "us.anthropic.claude-3-5-haiku-20241022-v1:0",
];

export function buildModelLadder(env = process.env): string[] {
  const explicit = env.BEDROCK_MODEL_IDS;
  if (explicit) {
    const ladder = explicit.split(",").map((m) => m.trim()).filter(Boolean);
    if (ladder.length > 0) return ladder;
  }
  const preferred = env.BEDROCK_MODEL_ID?.trim();
  if (preferred) {
    return [preferred, ...DEFAULT_LADDER.filter((m) => m !== preferred)];
  }
  return [...DEFAULT_LADDER];
}

export const MODEL_LADDER = buildModelLadder();

const SYSTEM = [
  "You explain one word to a child or adult who is learning to read.",
  "Rules, all mandatory:",
  "1. One sentence. Fifteen words or fewer.",
  "2. Use words that are simpler than the word you are explaining. A definition the reader cannot read is useless.",
  "3. Explain the meaning the word has in the sentence given, not another meaning it can have elsewhere.",
  "4. Do not repeat the word's own sentence back. Do not add examples, etymology, or encouragement.",
  "5. No emojis. No dashes of any kind as punctuation.",
  "Reply with the sentence only.",
].join("\n");

export interface Explanation {
  found: boolean;
  word: string;
  /** The line from the story where the word appears, always returned. */
  context?: string;
  explanation?: string;
  source: "bedrock" | "context-only" | "not-in-story";
  model?: string;
  attempts?: Array<{ model: string; ok: boolean; reason?: string }>;
  message?: string;
}

/** Strip attached punctuation so "pitcher," matches "pitcher". */
function bare(word: string): string {
  return word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "").toLowerCase();
}

/** Find the display line containing a word, using the caption document. */
export function findContext(story: Story, word: string): string | null {
  const target = bare(word);
  if (!target) return null;
  for (const segment of story.doc.segments) {
    if (segment.words.some((w) => bare(w.w) === target)) {
      return segment.text;
    }
  }
  return null;
}

export interface ExplainDeps {
  createText?: (system: string, user: string, model: string) => Promise<string>;
  models?: string[];
}

let cachedClient: AnthropicBedrock | null = null;

async function bedrockCreateText(
  system: string,
  user: string,
  model: string,
): Promise<string> {
  cachedClient ??= new AnthropicBedrock({
    awsRegion: process.env.AWS_REGION ?? "us-east-1",
  });
  const response = await cachedClient.messages.create({
    model,
    max_tokens: 120,
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("model declined");
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join(" ")
    .trim();
  if (!text) throw new Error("empty response");
  return text;
}

export async function explainWord(
  story: Story,
  word: string,
  deps: ExplainDeps = {},
): Promise<Explanation> {
  const context = findContext(story, word);
  if (!context) {
    // Refusing here is the useful answer. A definition of a word the reader
    // never saw would be confidently irrelevant.
    return {
      found: false,
      word,
      source: "not-in-story",
      message: `"${word}" does not appear in ${story.title}.`,
    };
  }

  const create = deps.createText ?? bedrockCreateText;
  const models = deps.models ?? MODEL_LADDER;
  const attempts: Array<{ model: string; ok: boolean; reason?: string }> = [];
  const prompt = `Sentence from the story: "${context}"\n\nExplain the word: ${word}`;

  for (const model of models) {
    try {
      const text = await create(SYSTEM, prompt, model);
      // A rambling answer defeats the point for a struggling reader, so it
      // fails this rung rather than the ladder.
      if (text.length > 200) {
        attempts.push({ model, ok: false, reason: "response too long" });
        continue;
      }
      attempts.push({ model, ok: true });
      return {
        found: true,
        word,
        context,
        explanation: text,
        source: "bedrock",
        model,
        attempts,
      };
    } catch (err) {
      attempts.push({ model, ok: false, reason: (err as Error).message });
    }
  }

  // Floor: show the reader the sentence the word lives in. Less helpful than
  // a definition, impossible to be wrong.
  return {
    found: true,
    word,
    context,
    source: "context-only",
    attempts,
    message:
      "No explanation service is available right now. Here is the sentence the word appears in.",
  };
}
