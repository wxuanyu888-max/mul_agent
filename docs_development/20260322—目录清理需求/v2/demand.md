# 需求文档：根目录异常目录清理 v2

## 1. 需求背景

v1 实施后，用户发现这些目录又重新生成了：
- `/Users/agent/PycharmProjects/mul_agent/:memory:`
- `/Users/agent/PycharmProjects/mul_agent/.transcripts/`
- `/Users/agent/PycharmProjects/mul_agent/coverage/`
- `/Users/agent/PycharmProjects/mul_agent/runtime/`

## 2. 问题分析

### 根本原因

1. **vitest coverage** - 默认在根目录生成 `coverage/` 目录
2. **transcripts** - 代码中默认使用 `.transcripts`（相对路径）
3. **runtime/** - 多个工具硬编码使用 `runtime/workspace`
4. **:memory:** - SQLite 在 macOS 上创建的 directory junction

### 涉及的文件

| 文件 | 问题 |
|------|------|
| `vitest.config.ts` | 未指定 coverage 目录 |
| `src/agents/context-engine/strategies.ts` | 默认 transcript 路径为 `.transcripts` |
| `src/agents/compaction.ts` | 默认 transcript 路径为 `.transcripts` |
| `src/memory/unified.ts` | workspace 路径为 `runtime/workspace` |
| `src/tools/web/fetch.ts` | 工作区路径为 `runtime/workspace` |
| `src/tools/media/video.ts` | 工作区路径为 `runtime/workspace` |
| `src/tools/file/grep.ts` | 工作区路径为 `runtime/workspace` |

## 3. 解决方案

1. **更新 vitest 配置** - 指定 coverage 输出到 `storage/coverage`
2. **更新 transcript 默认路径** - 从 `.transcripts` 改为 `storage/runtime/transcripts`
3. **更新 workspace 路径** - 从 `runtime/workspace` 改为 `storage/runtime/workspace`
4. **移动数据** - 将现有数据移动到 storage 目录
5. **清理根目录** - 删除根目录的异常目录

## 4. 约束条件

- 确保 memory、transcript、workspace 系统正常工作
- 不能丢失已有数据
- 所有运行时数据存放在 `storage/` 目录下
