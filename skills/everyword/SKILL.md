---
name: everyword
description: Work with EveryWord, a reading tool that puts karaoke-style same-language subtitles on video so each word lights up as it is spoken, turning watching into reading practice. Use this skill when a parent or teacher asks how much a child has actually read, wants a story recommended for a reader or for a set amount of time, asks what a word in a story means, wants to record that a reading session happened, or asks what is in the library. Also use it when someone asks how word-by-word subtitles help reading, or wants the text of a story.
license: MIT
compatibility: Requires network access to an EveryWord MCP server. The public demo server needs no credentials.
metadata:
  author: usv240
  version: "0.1.0"
  project: https://github.com/usv240/everyword
---

# EveryWord: watching becomes reading

EveryWord shows subtitles in the same language as the audio, with each word lighting up at the instant it is spoken. That mechanic, Same Language Subtitling, has run on Indian national television since 1996 and became national broadcast policy there in 2019. A five-year study of 13,000 people who could initially read little or nothing found 32 percentage points more children became good readers than in the unexposed group, at a cost of about four tenths of a cent per learner.

The product measures one thing no other reading tool can: **words a person actually read along with**, not minutes of video played.

## When to use this skill

| The user says | What to do |
|---|---|
| "How much has Maya read?" | `get_reading_progress` |
| "What should she read tonight?" | `recommend_story`, passing any time limit |
| "We only have five minutes" | `recommend_story` with `maxMinutes` |
| "What does 'pitcher' mean?" | `explain_word` with the story and the word |
| "She finished the crow one" | `record_reading_session` |
| "What stories are there?" | `list_library` |
| "What happens in that story?" | `get_story_text` |

## Connect

EveryWord is a Model Context Protocol server, spec 2025-11-25 over Streamable HTTP.

```
https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp
```

A local instance runs at `http://127.0.0.1:8788/mcp` (`npm run mcp`).

## The six tools

- **`list_library`** Every story with its word count, spoken duration, and narration pace in words per minute. Pace is the practical difficulty signal: slower is easier to follow.
- **`recommend_story`** One story for a reader, with the reason. Accepts `maxMinutes`, `maxWordsPerMinute`, and skips stories that reader has finished. Returns the constraints it applied, so the choice can be explained rather than asserted.
- **`get_reading_progress`** Words followed, sessions, stories completed, daily streak, this week against last week.
- **`record_reading_session`** Record a session. Capped at the story's real word count, so progress cannot be inflated.
- **`get_story_text`** The story as the reader sees it, one entry per displayed line.
- **`explain_word`** Explain one word in one short sentence, grounded in the sentence it appears in.

Story slugs, titles, and near misses all resolve: `crow-and-pitcher`, `The Crow and the Pitcher`, and `the-crow-and-the-pitcher` all find the same story.

## How to answer well

1. **Report words read, never minutes watched.** That distinction is the entire product. "Four hundred and twenty words across three sessions" is the answer. "Forty minutes of screen time" is a different and less useful fact.
2. **When recommending, say what constrained the choice.** "The shortest one she has not finished, under five minutes" lets a parent disagree with you. A bare recommendation does not.
3. **Keep it quiet.** No congratulation, no streak pressure, no gamification. Same Language Subtitling works because it is practice hidden inside something people already want to watch. A scoreboard breaks the mechanism it relies on.
4. **A small number is fine.** Ninety words is ninety words more than a passive hour.

## Hard rules

- **Never assess a reading level.** Never say a child is behind, ahead, struggling, or on track. EveryWord reports what was read, not how well.
- **Never diagnose anything**, including dyslexia or any learning difficulty, and never suggest testing for one.
- **Report only numbers the tools returned.** No estimates, no extrapolation.
- **Never compare one reader to another**, to an average, or to a grade level. There is no such comparator in the data.
- **`explain_word` only works for words actually in the story.** If the word is not there, the tool says so, and so should you. Do not define it from your own knowledge: the point is the meaning it carries in *that* sentence, and a definition of a different sense would mislead a learner.

## Worked example

User: *"How much has Maya read this week, and what should she read tonight? We have about five minutes."*

```
get_reading_progress { "readerId": "maya" }
→ totalWordsRead: 373, sessions: 3, storiesCompleted: 2, currentStreakDays: 1

recommend_story { "readerId": "maya", "maxMinutes": 5 }
→ pick: "hare-and-tortoise", reason: "Shortest story that satisfies: skipping 2
  already finished, at most 5 minutes"
```

A good answer:

> Maya has read 373 words this week across three sessions and finished two stories. For tonight, The Hare and the Tortoise: it runs about a minute, and it is one she has not finished yet.

A bad answer, and why:

> ~~Maya read 373 words, which is below average for her age. She may benefit from a reading assessment.~~

Invents a comparator that does not exist and edges toward diagnosis. Neither is supported by anything the tools return.

## Explaining a word

A child stuck on a word is the moment this tool matters most. `explain_word` checks the word is really in the story before anything else, supplies the sentence it appeared in as context, and returns one short sentence using simpler words than the one being explained.

```
explain_word { "slug": "crow-and-pitcher", "word": "pitcher" }
→ "A pitcher is a container with a handle used for pouring drinks like water or juice."

explain_word { "slug": "crow-and-pitcher", "word": "helicopter" }
→ found: false, "helicopter does not appear in The Crow and the Pitcher."
```

Read the explanation as given. Do not expand it: a definition a struggling reader cannot read is not a definition.

## Why word-level, and not ordinary subtitles

Ordinary captions are cue-level: a block of text appears and disappears. They are useful and legally required in many contexts, and they do **not** provide the word-to-sound binding the evidence rests on. The reader has to guess which word is being said.

Amazon already ships this mechanic for books, as Immersion Reading. No TV platform ships it for video. That gap is the reason EveryWord exists.

## More

Measured timing accuracy against gold alignments, evidence for every claim, and the open-source renderer any video app can adopt: <https://github.com/usv240/everyword>
