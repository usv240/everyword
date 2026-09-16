# The Reading Check-in agent

A Strands agent that answers a parent's question about a child's reading by talking to EveryWord's own MCP server.

## Why this exists

EveryWord measures something no other reading tool can: how many words a person actually read along with, rather than how many minutes of video played. That number is useless sitting in a database. The adult who cares about it does not open dashboards. They ask out loud, while doing something else.

So the division of labour is simple. The screen does the reading practice. The agent does the noticing.

## The closed loop

The agent does not reach into EveryWord's data. It calls the **same MCP server** Alexa+ would use (`apps/mcp/src/mcp.ts`, Model Context Protocol spec 2025-11-25 over Streamable HTTP). Five tools: `list_library`, `recommend_story`, `get_reading_progress`, `record_reading_session`, `get_story_text`.

If the MCP surface were wrong, this agent would be wrong too. That is the cheapest possible proof that the surface is real rather than declared.

## The safety rule, enforced in the prompt and in the design

The agent may **only** report numbers the tools returned. It never estimates a reading level, never suggests a child is behind or ahead, and never implies a diagnosis. Reading progress is reported, not judged.

It is also held to EveryWord's central distinction: words read means words the highlight passed while the child was reading. It is not screen time, and the agent is instructed never to describe it as such.

## Run it

```
pip install strands-agents strands-agents-tools
npm run mcp            # from the repo root: MCP server on :8788
python apps/agent/reading_check_in.py --reader maya
# against a deployed server instead:
python apps/agent/reading_check_in.py --url https://<function-url>/mcp
```

Verified output, from real tool calls against the shipped five-story library:

```
Tools discovered: get_reading_progress, get_story_text, list_library,
                  recommend_story, record_reading_session

Maya has read 373 words this week across three sessions and finished two
stories. For tonight I'd suggest The Hare and the Tortoise, which takes
under a minute and skips the two stories she's already finished.
```

Every number there came from a tool call, and the recommendation correctly excluded the two stories already finished.

Model: Claude on Amazon Bedrock (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`).
