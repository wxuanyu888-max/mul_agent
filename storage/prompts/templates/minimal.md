# Minimal Prompt Template (mode: minimal)

This template includes only essential sections - suitable for subagents.

```
{{base}}

## Tooling
Tool availability:
{{tool_list}}

{{tool_call_style}}

## Workspace
Your working directory is: {{workspace_dir}}
{{workspace_guidance}}

{{runtime}}
```
