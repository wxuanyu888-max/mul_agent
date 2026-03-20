# Memory & Search

## Grep Search (Default)

Use `grep` tool to search workspace files:
- Supports natural language queries (semantic search by default)
- `grep({query: "之前那个bug", mode: "semantic"})` - semantic search
- `grep({query: "TODO", mode: "exact"})` - exact regex match

## Memory Tool

Unified memory tool with actions:
- `memory({action: "search", query: "..."})` - semantic search in memory
- `memory({action: "get", path: "file.md", from: 1, lines: 100})` - read specific file
- `memory({action: "write", content: "...", path: "notes/xxx.md"})` - write to memory

## Memory Files

- `storage/memory/notes/` - Notes (automatically indexed)
- `storage/workspace/` - Workspace files (automatically indexed)

## Usage

- Find something → `grep` tool (semantic search)
- Read specific file → `read` tool
- Write to memory → `memory({action: "write", ...})`
