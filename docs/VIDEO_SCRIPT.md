# EveryWord demo video: shot list

Target length 2:45. Hard limit 3:00; judges are not required to watch past it, so the reader is on screen and lighting up words by second 20. Everything shown is the live deployment, so nothing in the video can differ from what a judge clicks.

Rules this video must satisfy, and where it does:

- Fire TV: "the demo video shows the project running on an actual Fire TV device or the Fire TV/Vega simulator." Shot 4 shows the Fire OS build on an Android Virtual Device, which is Amazon's documented method for emulating a Fire device, and says so on screen. docs/FIRE_TV_TARGET.md carries the full statement. Do not claim more than that.
- Alexa+: "show your MCP server (spec 2025-11-25+, Streamable HTTP) in action." Shots 5, 6 and 7.
- No third-party trademarks, music, or footage. All content is public-domain Aesop, narrated by Amazon Polly or LibriVox volunteers, both credited in CONTENT_LICENSES.md. No background track.
- English, public on YouTube.

## Before you press record

```
# 1. Terminal, large font (18pt+), dark theme, window sized to 1280x720.
export MCP=https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp
export API=https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws

# 2. Seed a reader so the check-in has real numbers to report.
#    (Sessions persist in DynamoDB, so this survives until you delete them.)
python - <<'PY'
import json, urllib.request, os
URL=os.environ["MCP"]
def rpc(m,p=None,sid=None,rid=1):
    b={"jsonrpc":"2.0","id":rid,"method":m}
    if p: b["params"]=p
    r=urllib.request.urlopen(urllib.request.Request(URL,data=json.dumps(b).encode(),
        headers={"content-type":"application/json",**({"mcp-session-id":sid} if sid else {})}))
    return r.headers.get("mcp-session-id"), json.loads(r.read().decode())
sid,_=rpc("initialize",{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"seed","version":"1"}})
for i,(slug,w,done) in enumerate([("crow-and-pitcher",97,True),("lion-and-mouse",180,True),("hare-and-tortoise",96,False)]):
    rpc("tools/call",{"name":"record_reading_session","arguments":{"readerId":"maya","slug":slug,"wordsFollowed":w,"completed":done}},sid,10+i)
print("seeded maya")
PY

# 3. Warm explain_word (first Bedrock call can take a few seconds).
python apps/agent/reading_check_in.py --url $MCP --reader maya \
  --ask "What does pitcher mean in The Crow and the Pitcher?"

# 4. Warm the check-in you will run on camera.
python apps/agent/reading_check_in.py --url $MCP --reader maya

# 5. Warm the resilience report.
curl -s $API/api/resilience | python -m json.tool

# 6. Have the Fire TV clip ready: everyword-demo.mp4 from the v0.1.0 GitHub
#    release. Trim to the best 20 seconds of the karaoke highlight moving.
```

Browser: https://d34emfdcezeszz.cloudfront.net at 125 percent zoom, light theme to start. Press Play once before recording so the audio is cached, then reload. Close every other tab. Hide bookmarks bar.

Record at 1080p, 30fps. Speak slowly. Pause half a second before each click.

## Shot list

### Shot 1: the hook (0:00 to 0:15)

Screen: landing page hero, reader visible below it.

Say: "Subtitles that light up word by word as they are spoken. In India this exact technique has reached an estimated 200 million viewers on national television and became broadcast policy in 2019. No TV platform has ever shipped it for video. This is it."

### Shot 2: the reader, live (0:15 to 0:50)

Screen: click a story card. Press Play. Let the highlight run for six full seconds with no narration; the product should speak for itself.

Say: "Every word lights at the instant it is spoken."

Screen: click "Read that line again". Let it replay.

Say: "Read that line again."

Screen: click "Slow down". Let two or three words pass.

Say: "Slow down, with the pitch preserved, so the voice a learner is matching to does not distort."

Screen: change the font size. Click the theme toggle to dark. Scroll to the meter.

Say: "Reading-optimised type, adjustable size, light and dark. And a quiet meter: words read along, not minutes watched. That distinction is the whole product."

### Shot 3: measured, not promised (0:50 to 1:10)

Screen: open docs/EVAL.md on GitHub, scrolled to the results table. Two seconds.

Say: "Against gold word alignments on LibriSpeech, the highlight lands within 30 milliseconds of the spoken word, and never lights a word early beyond 150 milliseconds across 766 matched words. Early is the one error a reading tool must never make."

Screen: back to the library. Point at a Polly-narrated story.

Say: "Two ways in. Human narration through Amazon Transcribe. Or any text at all through Amazon Polly, where the words are known rather than recognised, so caption word error is zero by construction. That is how a public-domain library becomes read-alongs."

### Shot 4: Fire TV (1:10 to 1:30)

Screen: the trimmed Fire TV clip. Overlay this text for the full shot, small, bottom left:

"Fire OS build (react-native-tvos). Shown on an Android Virtual Device, Amazon's documented method for emulating a Fire device. Multi-architecture APK on the GitHub release."

Say: "The same renderer on a ten-foot TV interface, driven entirely by D-pad. It is a Fire OS app, shipped as an APK that sideloads to any Fire TV. No physical device was available, so this is Amazon's documented virtual device; the release carries the ARM build for real hardware."

### Shot 5: the MCP server (1:30 to 1:42)

Screen: terminal. Run:

```
curl -s -D- -o /dev/null -X POST $MCP -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"demo","version":"1"}}}' \
  | grep -i mcp-session-id
```

Say: "The library and the reading meter are also an MCP server: spec 2025-11-25 over Streamable HTTP. The screen does the reading practice. An agent does the noticing."

### Shot 6: an agent notices (1:42 to 2:05)

Screen: terminal. Run the check-in against the live endpoint. Let the tool list print, then the answer.

```
python apps/agent/reading_check_in.py --url $MCP --reader maya
```

Say: "A Strands agent on Bedrock, with no data access of its own. It reads Maya's real progress through the tools, picks something she has not finished, and explains the constraint it applied. It reports only numbers the tools returned. It never assesses a reading level."

### Shot 7: a word she is stuck on (2:05 to 2:25)

Screen: terminal. Run:

```
python apps/agent/reading_check_in.py --url $MCP --reader maya \
  --ask "Maya got stuck on the word pitcher in The Crow and the Pitcher. What does it mean, in a way she can understand?"
```

Say: "Explain a word. The word must appear in the story before any model is called, the sentence it appears in is the context, and the answer is one line a struggling reader can read."

Screen: run the same with "helicopter". Show the refusal.

Say: "Ask about a word that is not in the story, and it says so rather than guessing."

### Shot 8: nothing fails into silence (2:25 to 2:38)

Screen: terminal. Resilience curl, scrolled so the catalogue and explainWord sections are visible.

Say: "Reading progress lives in DynamoDB as an append-only log; every number is derived, never stored. The catalogue retries and falls back to a bundled copy. The model ladder falls back to the reader's own sentence. The karaoke timing never touches a model at all."

### Shot 9: close (2:38 to 2:50)

Screen: landing page evidence section, then the repo link.

Say: "A five-year study of 13,000 people who could barely read found 32 percentage points more children became good readers, at a cost of four tenths of a cent per learner. 58.9 million American adults read at the lowest level, and the number is rising. Open source, MIT, live at the link."

Hold on the URL for two seconds. Cut.

## Do not say

- "200 million readers." The sourced figure is viewers.
- Anything about assessing, diagnosing, or screening reading ability. It reports what was read.
- "Runs on a Fire TV" without the qualifier in Shot 4.
- Any number not in docs/EVIDENCE.md or docs/EVAL.md.

## After recording

- Export 1080p, H.264. No music.
- YouTube: title "EveryWord: subtitles that teach reading", visibility Public, not Unlisted. Description: one paragraph, the reader URL, the repo URL, the MCP URL, and the Fire TV qualifier from Shot 4 verbatim.
- Paste the link into docs/SUBMISSION.md under Links, and into the Devpost form.
