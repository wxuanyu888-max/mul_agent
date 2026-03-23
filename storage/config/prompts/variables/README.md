# Variables

This directory contains variable definitions that are injected into prompt templates at runtime.

## Variable Naming Convention

Variables use double curly braces: `{{variable_name}}`

## Available Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `workspace_dir` | Current working directory | `/home/user/project` |
| `workspace_guidance` | Workspace-specific guidance | Use this directory as... |
| `workspace_notes` | Additional workspace notes | Custom notes... |
| `runtime_info` | Runtime information | agent=xxx host=xxx os=xxx |
| `reasoning_level` | Reasoning level | off / on / stream |
| `heartbeat_prompt` | Heartbeat prompt text | (configured) |
| `docs_path` | Documentation path | /path/to/docs |
| `message_channel_options` | Available message channels | telegram\|signal\|slack |
| `message_tool_hints` | Message tool hints | Custom hints... |
| `inline_buttons_hint` | Inline buttons support hint | Enabled / Disabled |
| `reaction_guidance` | Reaction guidance | MINIMAL / EXTENSIVE mode |
| `reasoning_format_hint` | Reasoning format hint | Use <think>... |
| `model_alias_lines` | Model alias lines | sonnet: claude-sonnet-4-20250514 |
| `sandbox_info` | Sandbox configuration | Docker info... |
| `sandbox_container_workspace` | Sandbox container workdir | /sandbox/workspace |
| `sandbox_workspace_access` | Workspace access level | read-write |
| `sandbox_browser_info` | Browser bridge info | URL or disabled |
| `sandbox_elevated_info` | Elevated exec info | Allowed / Not allowed |
| `skills_prompt` | Skills content | (from skills/*.md) |
| `context_files` | Injected context files | CLAUDE.md, SOUL.md content |
| `tool_list` | Available tools list | (generated from tools) |

## Usage

Variables are replaced by the code that loads and composes the prompts. See the prompt builder implementation for details.
