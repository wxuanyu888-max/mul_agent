/**
 * MulAgent 记忆系统最终方案 v2
 *
 * 核心思路：
 * 1. 工作区文件自动索引到向量库
 * 2. grep 默认调用 rag search
 * 3. 用户感知就是一个统一的搜索
 */

# 整体架构

```
storage/
├── workspace/           # 工作区（源文件）
│   ├── src/
│   ├── docs/
│   └── ...
└── memory/
    └── index/          # 向量索引（自动从 workspace 索引）
```

---

# 1. 自动索引

## 索引什么？

```
workspace/ 目录下的所有文件自动索引到向量库
```

| 文件类型 | 示例 |
|---------|------|
| 代码 | .ts, .js, .py, .go... |
| 文档 | .md, .txt, .json... |
| 配置 | .yaml, .toml... |

## 实现

```typescript
// 启动时或文件变化时
const manager = await getMemoryIndexManager();

// 同步工作区文件
await manager.sync({
  reason: 'boot',
  paths: ['storage/workspace/']
});

// 启动文件监视（可选）
manager.startFileWatching();
```

---

# 2. Grep = Rag Search

## 现在的流程

```
用户/Agent: grep("query")
                │
                ▼
        ┌───────────────┐
        │ rag search   │  ← 直接搜向量库
        └───────────────┘
                │
                ▼
返回: [{path, snippet, score}, ...]
```

## 优点

| 优点 | 说明 |
|-----|------|
| **统一入口** | 一个 grep 搞定所有搜索 |
| **语义理解** | 能搜"之前那个bug"而不是精确匹配 |
| **自动同步** | 文件变化自动更新索引 |
| **来源透明** | 用户不需要知道搜的是文件还是记忆 |

---

# 3. Grep 参数

```typescript
{
  tool: "grep",
  params: {
    query: "搜索内容",      // 支持自然语言
    path: "storage/workspace/",  // 搜索范围
    maxResults: 10        // 返回数量
  }
}
```

## 返回

```typescript
{
  results: [
    {
      path: "src/utils/helper.ts",
      snippet: "function fixBug() { ... }",
      score: 0.95,
      startLine: 10,
      endLine: 20
    },
    {
      path: "docs/todo.md",
      snippet: "- 修复之前的那个 bug",
      score: 0.88,
      startLine: 5,
      endLine: 8
    }
  ],
  count: 2,
  query: "搜索内容"
}
```

---

# 4. System Prompt

```markdown
## 搜索系统

使用 grep 工具搜索：
- 会自动搜索 workspace 目录下的所有文件
- 基于语义理解（向量搜索）
- 示例: grep("之前那个bug") 能找到相关记录

## 工作区
位置: storage/workspace/
- src/: 源代码
- docs/: 文档
- 其他: 配置、日志等

需要读取文件内容时用 read 工具。
```

---

# 5. 实现要点

## 1. 启动时索引

```typescript
// main.ts
const manager = await getMemoryIndexManager({
  workspaceDir: 'storage/workspace',
  config: { provider: 'offline' }  // 或其他 provider
});

// 初始同步
await manager.sync({ reason: 'boot' });

// 可选：启动文件监视
manager.startFileWatching();
```

## 2. Grep 工具改造

```typescript
// 旧的 grep：正则匹配文件
// 新的 grep：调用 rag search

export function createGrepTool() {
  return {
    name: 'grep',
    execute: async (params) => {
      const manager = await getManager();
      const results = await manager.search(params.query, {
        maxResults: params.maxResults
      });
      return jsonResult({ results });
    }
  };
}
```

---

# 6. 对比

## 旧方案

```
grep → 正则匹配文件
memory_search → 向量搜记忆
```

## 新方案（最终）

```
grep → 向量搜索（自动包含工作区文件）
```

---

# 7. 可选：保留文件搜索

如果有时候需要精确匹配，可以保留一个选项：

```typescript
{
  tool: "grep",
  params: {
    query: "xxx",
    mode: "semantic" | "exact"  // semantic = 向量, exact = 正则
  }
}
```

---

# 总结

| 组件 | 说明 |
|-----|------|
| **工作区** | 源文件位置 |
| **向量库** | 自动从工作区索引 |
| **grep** | 默认调用 rag search |
| **read** | 需要时读取完整文件内容 |

**核心：一个 grep 搞定所有搜索**
