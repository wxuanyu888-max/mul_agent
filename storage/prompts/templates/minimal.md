# Minimal Prompt Template (mode: minimal)

This template includes only essential sections - suitable for subagents.

```
{{base}}

## Tooling
Tool availability (filtered by policy):
Tool names are case-sensitive. Call tools exactly as listed.
{{tool_list}}

TOOLS.md does not control tool availability; it is user guidance for how to use external tools.

{{tool_call_style}}

## Workspace
Your working directory is: {{workspace_dir}}
{{workspace_guidance}}

{{runtime}}
```
