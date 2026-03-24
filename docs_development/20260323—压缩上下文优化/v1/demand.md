# 需求文档：压缩上下文优化

## 需求背景

当前项目已有基础的上下文压缩功能（位于 `src/agents/compaction.ts` 和 `src/agents/context-engine/strategies.ts`），但在生产环境中存在以下问题：

1. **压缩时丢失用户需求**：auto_compact 会把所有消息都压缩成摘要，包括用户最近的任务需求 ❌ **已修复**

## 修复内容

### 问题

原代码中 `autoCompact` 函数会将所有消息都压缩成摘要，导致用户的当前需求也被压缩丢失。

### 解决方案

添加了 `keepRecentUserMessages` 配置项（默认 2 条），在压缩时：
1. **保留用户最近的消息**（包含当前任务需求）不压缩
2. 只对历史上下文进行 LLM 摘要
3. 摘要中只描述历史对话，用户的当前需求保持原样

### 修改文件

| 文件 | 改动 |
|------|------|
| [compaction.ts](src/agents/compaction.ts) | 添加 `keepRecentUserMessages` 配置，修改 `autoCompact` 逻辑 |
| [context-engine/types.ts](src/agents/context-engine/types.ts) | 添加配置类型定义 |
| [context-engine/strategies.ts](src/agents/context-engine/strategies.ts) | 修改 `AutoCompactStrategy` |

### 配置项

```typescript
interface CompactionConfig {
  // ... 其他配置
  /** 保留最近 N 条用户消息（包含当前需求），不压缩 */
  keepRecentUserMessages?: number;  // 默认 2
}
```

### 压缩后消息结构

```
[System messages]
[Historical summary]  ← 只压缩这部分
[User message N-1]    ← 保留
[User message N]      ← 保留（当前需求）
[Assistant response]  ← 确认消息
```

---

**状态**：✅ 已完成修复
