# Amazon Devices Builder Tools: what we used it for and what it told us

The Builder Tools MCP server is the first item under "Start here" in the hackathon resources, and the recommended starting point for Fire TV work. We used it, and it changed a design decision, so this file records what it gave us and what we would tell the team that builds it.

## What we did

```
npx @amazon-devices/amazon-devices-buildertools-mcp@latest init-context --agent claude-code-cli
```

We then spoke MCP to the server directly over stdio to enumerate and exercise it, rather than only consuming it through an agent, because we wanted to evaluate the tool itself.

Server: `Amazon Devices Builder Tools MCP` v1.0.11, protocol revision 2025-03-26, advertising tools, resources, prompts, and logging capabilities. Nine tools:

| Tool | What it does |
|---|---|
| `set_project_context` | Required first call; gates every other tool |
| `list_documents` | Lists KB, PROMPT, STEERING, WORKFLOW, and SKILL documents per platform |
| `search_documentation` | Full-text search across Vega and Fire OS docs |
| `read_document` | Fetches a document by URI |
| `read_asset` | Fetches assets referenced by the docs |
| `analyze_perfetto_traces` | Vega trace analysis for KPI extraction |
| `get_app_hot_functions` | CPU hot-function analysis from trace files |
| `symbolicate_acr` | Symbolicates Amazon Crash Report files |
| `report_workflow_status` | Workflow completion telemetry |

## What it told us, and why it mattered

Searching for `captions` returned a Vega workflow document, `react_native_for_vega_add_captions_and_subtitles.md`, that we would not have found otherwise. It documents how caption rendering actually works on Vega OS:

- Captions render through `@amazon-devices/react-native-w3cmedia` with `KeplerCaptionsView` and the W3C TextTrack API.
- Out-of-band text tracks are added with `addTextTrack()` and support `text/vtt`, `application/ttml+xml`, and several other subtitle MIME types.
- Cues are `VTTCue` objects, supplied by a polyfill in v2.1.14+ (`VTTRegion` is not supported).
- The app must declare `com.amazon.devconf.privilege.accessibility` in `manifest.toml`.

**The consequence for EveryWord:** a `VTTCue` carries one start and one end time for the whole cue. The native caption path can therefore display a line at a time, but not a word at a time, which is the entire product. WebVTT as a format does support word-level timing through inline timestamp tags inside a cue payload, but that is a rendering behavior the platform's caption view does not expose.

So this tool did two useful things in one search:

1. **It validated our architecture.** EveryWord ships its own renderer (`karaoke-captions-react`) not as a shortcut around the platform, but because the platform's caption pipeline cannot express word-level timing. That is now a documented reason rather than an assumption.
2. **It produced our clearest platform feature request.** If `KeplerCaptionsView` honored WebVTT inline timestamp tags, every Vega app would get karaoke captions for free, and Same Language Subtitling, the literacy technique behind this project, would become a platform capability instead of an app feature.

It also prompted a real interop improvement: EveryWord now exports standard WebVTT alongside its own format, in both plain and karaoke modes, so content processed by our pipeline works in any ordinary player and our format is a superset rather than a silo.

## Feedback for the Builder Tools team

Three issues, all reproducible, filed in full in FRICTION_LOG.md (entries 9 to 11):

1. **`init-context` cannot run non-interactively.** It documents flags such as `--skip-mcp-config` and `--agent`, but still prompts for MCP config path confirmation, and when stdin is not a TTY it crashes with `ERR_USE_AFTER_CLOSE: readline was closed` instead of taking a default. That rules out CI, scripted setup, and any headless agent environment.
2. **`init-context` wants to edit the user's global agent config** (`~/.claude.json`) with no project-scoped option offered in the prompt. A project-local choice would let a developer try the tool without changing their whole machine.
3. **Argument validation errors do not say which argument is wrong.** Calling `search_documentation` without `target_platform` returns only `Invalid arguments provided for tool search_documentation`. The tool's own JSON schema knows the field is required; echoing the missing path would save a round trip. `set_project_context`, by contrast, returns an excellent error that tells the caller exactly what to do, which is the standard the others should meet.

The documentation corpus itself is the strong part: the Vega workflow documents are specific, current, and answered a question we had been guessing at.
