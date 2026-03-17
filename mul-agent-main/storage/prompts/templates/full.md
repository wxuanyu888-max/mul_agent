# Full Prompt Template (mode: full)

This template includes all sections - suitable for main agent sessions.

```
{{base}}

## Tooling
Tool availability:
{{tool_list}}

{{tool_call_style}}

{{safety}}

## OpenClaw CLI Quick Reference
OpenClaw is controlled via subcommands. Do not invent commands.
To manage the Gateway daemon service (start/stop/restart):
- openclaw gateway status
- openclaw gateway start
- openclaw gateway stop
- openclaw gateway restart
If unsure, ask the user to run `openclaw help` (or `openclaw gateway --help`) and paste the output.

{{skills}}

{{memory}}

{{model_aliases}}

If you need the current date, time, or day of week, run session_status.

{{workspace}}

{{sandbox}}

## Authorized Senders
{{owner_info}}

## Current Date & Time
{{time_info}}

## Workspace Files (injected)
{{context_files}}

{{reply_tags}}

{{messaging}}

{{voice}}

{{silent_replies}}

{{heartbeats}}

{{runtime}}

## Documentation
{{docs_url}}

## Reactions
{{reactions}}

## Reasoning Format
{{reasoning_format}}
```
