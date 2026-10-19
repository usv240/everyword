"""EveryWord's Reading Check-in agent, hosted on Amazon Bedrock AgentCore Runtime.

Invoke with {"prompt": "How much has maya read this week?"}. The agent is the
same Strands agent as apps/agent/reading_check_in.py (a copy sits beside this
file; a test fails if they differ): it answers a parent from EveryWord's MCP
tools only, the endpoint Alexa+ uses (spec 2025-11-25, Streamable HTTP), and
it may report only numbers the tools returned and never assess a reading
level.
"""

from __future__ import annotations

import os

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models import BedrockModel

import reading_check_in as rc

app = BedrockAgentCoreApp()
log = app.logger

MCP_URL = os.environ.get("EVERYWORD_MCP_URL", "https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6")


@app.entrypoint
def invoke(payload, context):
    question = "How much has maya read this week, and what should she read tonight if we only have about five minutes?"
    if isinstance(payload, dict) and isinstance(payload.get("prompt"), str) and payload["prompt"].strip():
        question = payload["prompt"].strip()
    log.info("reading check-in: %s", question)
    client = rc.build_client(MCP_URL)
    with client:
        tools = client.list_tools_sync()
        agent = Agent(model=BedrockModel(model_id=MODEL_ID, region_name="us-east-1"), tools=tools,
                      system_prompt=rc.SYSTEM_PROMPT, name="everyword-reading-check-in", callback_handler=None)
        text = str(agent(question)).strip()
    return {"answer": text, "model": MODEL_ID, "runtime": "Amazon Bedrock AgentCore Runtime"}


if __name__ == "__main__":
    app.run()
