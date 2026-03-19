/**
 * MulAgent 记忆系统重新设计方案 v2
 *
 * 核心区别：
 * 1. Short Memory = 会话加载，不需要单独设计
 * 2. Remote Memory = LLM 自己决定写入
 * 3. Vector Memory = 明确什么内容应该进向量库
 * 4. Workspace = 只在 prompt 里告诉 agent，不做工具
 */

# 整体架构

```
storage/
├── memory/
│   ├── MEMORY.md           # 向量记忆（需要语义搜索的）
│   └── daily/
│       └── YYYY-MM-DD.md   # 每日笔记
└── workspace/              # 工作文件（prompt 告知，不做工具）
    ├── docs/
    ├── data/
    └── logs/
```

---

# 1. 向量记忆 (Vector Memory)

## 什么内容应该进向量库？

| 内容类型 | 示例 | 写入时机 |
|---------|------|---------|
| **重要决策** | "使用 SQLite 而非 MongoDB" | LLM 自己做决定 |
| **项目架构** | "项目使用 MVC 架构" | LLM 自己做决定 |
| **解决方案** | "这个 bug 是因为..." | LLM 自己做决定 |
| **用户偏好** | "用户喜欢中文回复" | 用户说"记住" |
| **关键信息** | API 密钥、配置 | 用户说"记住" |

## 核心原则

**由 LLM 决定什么时候写入**：
- 通过 System Prompt 引导 LLM："如果你认为某些信息重要，应该被记住，写入 MEMORY.md"
- 用户明确说"记住这个"时，LLM 写入

**不需要单独的工具**：
- 直接使用 `write` 工具写入 `MEMORY.md`
- 向量系统自动索引

---

# 2. 每日笔记 (Daily Memory)

## 什么内容写入每日笔记？

| 内容类型 | 示例 | 写入时机 |
|---------|------|---------|
| **工作进度** | "今天完成了用户认证" | 上下文压缩前 |
| **临时想法** | "可能需要重构..." | LLM 自己做决定 |
| **调试信息** | "发现 xxx 问题" | LLM 自己做决定 |

## 自动刷新机制

在上下文快压缩前（**Pre-Compaction**）：

```
当 context 剩余 tokens < 4000 时：
  → 静默触发 LLM："把重要的写入 MEMORY.md，日常的写入 daily/YYYY-MM-DD.md"
  → 用户看不到这个交互
```

---

# 3. Workspace (工作区)

## 不做工具，只在 Prompt 里告知

**System Prompt 示例**：

```
## 工作区文件
工作区目录: storage/workspace/
- docs/: 项目文档
- data/: 数据文件
- logs/: 日志文件

需要时你可以直接读取这些文件。
```

**LLM 自己的决定**：
- 当需要读取原始数据 → 自己调用 `read` 工具
- 当需要查看日志 → 自己调用 `read` 工具
- 不需要额外的 workspace 工具

---

# 4. 写入流程

## LLM 写入记忆的决策树

```
LLM 收到信息
    │
    ▼
这个需要持久化吗？
    │
    ├─ 否 → 不写入
    │
    ▼
是重要决策/架构/解决方案吗？
    │
    ├─ 是 → 写入 MEMORY.md (向量记忆)
    │
    ▼
是日常笔记/工作进度吗？
    │
    ├─ 是 → 写入 daily/YYYY-MM-DD.md (每日笔记)
    │
    ▼
是用户明确说"记住这个"吗？
    │
    ├─ 是 → 写入 MEMORY.md (向量记忆)
    │
    ▼
其他 → 不写入
```

---

# 5. 搜索流程

## 什么时候触发向量搜索？

| 场景 | 触发方式 |
|-----|---------|
| **用户问相关问题** | LLM 自己决定调用 memory_search |
| **上下文需要补充** | LLM 自己决定调用 memory_search |
| **Pre-Compaction** | 系统自动触发 |

## LLM 使用向量搜索的决策树

```
LLM 需要信息
    │
    ▼
工作区文件里有吗？（根据 prompt 知道目录结构）
    │
    ├─ 是 → 读取文件
    │
    ▼
之前记住过吗？（MEMORY.md / daily/）
    │
    ├─ 是 → 调用 memory_search
    │
    ▼
没有 → 直接回答或继续
```

---

# 6. System Prompt 设计

```markdown
## 记忆系统

### 长期记忆 (MEMORY.md)
- 重要决策、项目架构、解决方案、用户偏好
- 写入方式: 直接编辑 storage/memory/MEMORY.md

### 每日笔记 (daily/)
- 工作进度、临时想法、调试信息
- 写入方式: 直接编辑 storage/memory/daily/YYYY-MM-DD.md
- 上下文压缩前会自动提醒你写入

### 工作区文件
- 位置: storage/workspace/
- 目录结构:
  - docs/: 项目文档
  - data/: 数据文件
  - logs/: 日志文件
- 需要时直接读取

### 使用原则
- 如果你认为某些信息重要，应该被记住，写入 MEMORY.md
- 用户说"记住这个"时，写入 MEMORY.md
- 日常笔记写入 daily/YYYY-MM-DD.md
```

---

# 7. 实现要点

## 7.1 Pre-Compaction 触发

```typescript
// 在上下文压缩前触发
if (contextTokens < COMPACTION_THRESHOLD) {
  await llm.silentComplete({
    system: "...",
    user: "把重要的写入 MEMORY.md，日常的写入 daily/YYYY-MM-DD.md"
  });
}
```

## 7.2 向量索引

- 监视 `storage/memory/` 目录
- 文件变化时自动更新索引
- 支持混合搜索 (BM25 + Vector)

## 7.3 工具简化

```typescript
// 只保留一个 write 工具
{
  tool: "memory_write",
  params: {
    content: "...",
    type: "memory" | "daily"  // 让 LLM 决定类型
  }
}

// 搜索工具
{
  tool: "memory_search",
  params: {
    query: "..."
  }
}
```

---

# 总结

| 组件 | 作用 | 实现方式 |
|-----|------|---------|
| **向量记忆** | 重要决策、架构、解决方案 | LLM 自己写入 MEMORY.md |
| **每日笔记** | 工作进度、临时想法 | LLM 自己写入 daily/ |
| **工作区** | 原始数据、日志、文档 | 只在 prompt 告知 |
| **Pre-Compaction** | 自动刷新记忆 | 系统静默触发 |

**核心思路**：让 LLM 自己决定什么时候写入，而不是系统自动处理。
