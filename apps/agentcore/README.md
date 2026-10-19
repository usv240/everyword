# EveryWord's Reading Check-in agent, hosted on Amazon Bedrock AgentCore

The same Strands agent as [`apps/agent/reading_check_in.py`](../agent/reading_check_in.py), deployed to AgentCore Runtime as an invocable endpoint.

```
Runtime: everywordreading_reading
Region:  us-east-1
Model:   us.anthropic.claude-sonnet-4-6
```

It answers a parent from EveryWord's MCP tools only (the endpoint Alexa+ uses, spec 2025-11-25 over Streamable HTTP): how many words a reader actually followed on screen, and what to read next under a constraint the parent gives. It reports only numbers the tools returned and never assesses a reading level.

## Verified running, 2026-10-19

```
npx @aws/agentcore invoke --prompt "How much has maya read this week, and what should she read tonight if we only have about five minutes?"
```

It answered that nothing had been recorded for that reader yet, recommended a 97-word story under the five-minute limit, and named the constraint so the parent can disagree.

## Deploy it yourself

```
cd apps/agentcore
cp agentcore/aws-targets.example.json agentcore/aws-targets.json   # set your account id
(cd agentcore/cdk && npm install)
npx @aws/agentcore deploy --yes
```

`app/reading/reading_check_in.py` is a copy of `apps/agent/reading_check_in.py`; `apps/eval/test/agentcore-copy.test.ts` fails if they differ.
