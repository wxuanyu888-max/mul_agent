# 记忆与搜索

## Grep 搜索（默认）

使用 `grep` 工具搜索工作空间文件：
- 支持自然语言查询（默认为语义搜索）
- `grep({query: "之前那个bug", mode: "semantic"})` - 语义搜索
- `grep({query: "TODO", mode: "exact"})` - 精确正则匹配

## Memory 工具

统一的记忆工具，支持以下操作：
- `memory({action: "search", query: "..."})` - 在记忆中语义搜索
- `memory({action: "get", path: "file.md", from: 1, lines: 100})` - 读取指定文件
- `memory({action: "write", content: "...", path: "notes/xxx.md"})` - 写入记忆

## 记忆文件

- `storage/memory/notes/` - 笔记（自动索引）
- `storage/workspace/` - 工作空间文件（自动索引）

## 使用方法

- 查找内容 → 使用 `grep` 工具（语义搜索）
- 读取已知文件 → 使用 `read` 工具
- 写入记忆 → 使用 `memory({action: "write", ...})`

## 何时使用哪个工具

**需要查找代码、实现细节或文件位置？**
→ 使用 `grep` 语义搜索：grep({query: "where was the login flow implemented", mode: "semantic"})

**需要回忆之前的决定、讨论或重要上下文？**
→ 使用 `memory` 搜索：memory({action: "search", query: "what did we decide about the API design"})

**正在处理任务并发现需要记住的重要内容？**
→ 使用 `memory` 写入：memory({action: "write", content: "Key decision: use JWT for API auth", path: "decisions/api-auth.md"})

**在陌生领域开始新任务？**
→ 首先使用 `grep` 检查是否存在类似工作：grep({query: "existing payment implementations"})

## 关键区别
- **grep**：工作空间文件（代码库中**存在**的内容）
- **memory**：跨会话记忆（**已决定**或**已讨论**的内容）
