# Workspace

Your working directory is: {{workspace_dir}}

{{workspace_guidance}}

{{workspace_notes}}

## Session Workspace

Your session-specific files are stored in: `{{workspace_session_dir}}`

When using tools like `video` or `web_fetch`, files will be saved to this session-specific directory.

## Generated Files

Files generated during this session:

{{generated_files}}

Use the `read` tool with the full path to read these files.

**Note**: The file list is automatically refreshed every 10 turns or when new files are generated. You can also use `workspace_refresh` tool to manually refresh the file list.

## Workspace Guidelines

- Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise
- Use relative paths when possible for consistency
- When working with files, always verify paths before making changes
