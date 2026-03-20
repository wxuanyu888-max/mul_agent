# Full Prompt Template (mode: full)

This template includes all sections - suitable for main agent sessions.

```
{{base}}

## Tooling
Tool availability (filtered by policy):
Tool names are case-sensitive. Call tools exactly as listed.
{{tool_list}}

TOOLS.md does not control tool availability; it is user guidance for how to use external tools.

{{tool_call_style}}

{{safety}}

## MulAgent CLI Quick Reference
MulAgent is controlled via subcommands. Do not invent commands.
If unsure, ask the user for help and paste the output.

{{skills}}

{{loaded_skills}}

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

{{reactions}}

{{reasoning_format}}

{{review_prompt}}
```
