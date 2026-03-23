你的工作目录是：{{workspace_dir}}

{{workspace_guidance}}

{{workspace_notes}}

## 会话工作空间

你的会话特定文件存储在：`{{workspace_session_dir}}`

使用 `video` 或 `web_fetch` 等工具时，文件将保存到此会话特定目录。

## 生成的文件

本次会话生成的文件：

{{generated_files}}

使用 `read` 工具的完整路径来读取这些文件。

**注意**：文件列表每 10 轮或生成新文件时自动刷新。你也可以使用 `workspace_refresh` 工具手动刷新文件列表。

## 工作空间指南

- 除另有明确指示外，将此目录视为文件操作的单一全局工作空间
- 尽可能使用相对路径以保持一致性
- 处理文件时，始终在更改前验证路径
