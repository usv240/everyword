"""The Reading Check-in agent.

A Strands agent that answers a parent's question about a child's reading by
talking to EveryWord's own MCP server.

Why this exists: EveryWord measures something no other reading tool can,
which is how many words a person actually read along with rather than how
many minutes of video played. That number is useless sitting in a database.
The adult who cares about it does not open dashboards; they ask out loud
while doing something else.

The point of building it this way: the agent is a second, independent
client of the same Model Context Protocol server that Alexa+ would use
(apps/mcp/src/mcp.ts, spec 2025-11-25 over Streamable HTTP). It has no
database access and no privileged path. If the MCP surface were wrong, this
agent would be wrong too, which is the cheapest possible proof that the
surface is real.

Usage:
    python reading_check_in.py [--url http://127.0.0.1:8788/mcp] [--reader maya]
"""

from __future__ import annotations

import argparse
import json
import sys

from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient

DEFAULT_MCP_URL = "http://127.0.0.1:8788/mcp"
# The most capable Claude this AWS account can invoke; see the Nightlight
# FRICTION_LOG entry 5 for why it is not a current-generation model.
MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"

SYSTEM_PROMPT = """You help a parent keep track of a child's reading, using a
reading tool called EveryWord. EveryWord plays stories on screen with
subtitles that light up word by word as they are spoken, so watching becomes
reading practice.

You have tools that read EveryWord. How to work:
1. Call get_reading_progress for the reader in question.
2. If the parent is choosing something to read, call recommend_story, and
   pass any constraint they gave you such as how long they have.
3. Use list_library or get_story_text if you need to say something specific
   about a story.

Hard rules:
- Report only numbers the tools returned. Never estimate, never extrapolate.
- "Words read" means words the highlight passed while the child was reading.
  It is not minutes of video. Do not describe it as screen time.
- Never assess a reading level, never suggest a child is behind or ahead,
  and never imply a diagnosis. You report what happened and nothing more.
- If a recommendation was constrained, say what the constraint was, so the
  parent can disagree with the choice.
- If nothing has been recorded yet, say so plainly rather than filling the
  gap with encouragement.
- Write three sentences or fewer, warm and plain, second person. No emojis.
  No dashes of any kind as punctuation.

Output format: the answer itself and nothing else. No preamble, no heading,
no commentary about the tools or your process.
"""


def build_client(url: str) -> MCPClient:
    """An MCP client over Streamable HTTP, the transport the server speaks."""
    return MCPClient(lambda: streamablehttp_client(url))


def main() -> int:
    parser = argparse.ArgumentParser(description="EveryWord reading check-in agent")
    parser.add_argument("--url", default=DEFAULT_MCP_URL, help="EveryWord MCP endpoint")
    parser.add_argument("--reader", default="maya", help="Which reader to report on")
    parser.add_argument(
        "--ask",
        default=None,
        help="What to ask; defaults to a weekly check-in for the reader",
    )
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args()

    question = args.ask or (
        f"How much has {args.reader} read this week, and what should they read "
        f"tonight if we only have about five minutes?"
    )

    client = build_client(args.url)
    with client:
        tools = client.list_tools_sync()
        tool_names = sorted(getattr(t, "tool_name", str(t)) for t in tools)
        if not args.json:
            print(f"Connected to {args.url}")
            print(f"Tools discovered: {', '.join(tool_names)}\n")

        agent = Agent(
            model=BedrockModel(model_id=MODEL_ID, region_name="us-east-1"),
            tools=tools,
            system_prompt=SYSTEM_PROMPT,
            name="everyword-reading-check-in",
            description="Answers a parent's question from EveryWord's MCP tools only.",
            callback_handler=None,
        )
        result = agent(f"The reader is {args.reader}. {question}")
        text = str(result).strip()

    if args.json:
        print(json.dumps({"answer": text, "tools": tool_names, "model": MODEL_ID}, indent=1))
    else:
        print("=" * 62)
        print("READING CHECK-IN")
        print("=" * 62)
        print(text)
        print("=" * 62)
        print("Written by a Strands agent from EveryWord's MCP tools only.")
        print("Words read means words followed on screen, not minutes played.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
