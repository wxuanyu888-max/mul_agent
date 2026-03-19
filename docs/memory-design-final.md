/**
 * MulAgent 记忆系统最终方案
 *
 * 核心思路：
 * 1. 自动填充：工具调用、对话等自动写入向量库
 * 2. 统一搜索：grep 时同时搜文件和 memory，一起返回
 */

# 整体架构

```
storage/
├── memory/
│   ├── auto/              # 自动写入（工具调用、对话）
│   │   ├── tool_calls/    # 工具调用记录
│   │   ├── messages/      # 对话记录
│   │   └── ...
│   └── notes/             # 手动写入（LLM 自己写的）
│       └── ...
└── workspace/             # 工作文件（只在 prompt 告知）
    └── ...
```

---

# 1. 自动填充 (Auto-Ingest)

## 什么自动写入？

| 来源 | 内容 | 写入时机 |
|-----|------|---------|
| **工具调用** | `{tool: "xxx", params: {...}, result: "..."}` | 每次工具调用后 |
| **对话消息** | `{role: "user/assistant", content: "..."}` | 每次消息后 |
| **LLM 输出** | LLM 生成的重要内容 | LLM 认为需要记住时 |
| **用户输入** | 用户说的重要内容 | 可选 |

## 实现方式

```typescript
// 工具调用后自动写入
async function onToolCall(toolCall: ToolCall) {
  const content = `
Tool: ${toolCall.name}
Params: ${JSON.stringify(toolCall.params)}
Result: ${JSON.stringify(toolCall.result).substring(0, 500)}
Time: ${new Date().toISOString()}
  `;

  await writeToMemory('auto/tool_calls/', content);
}

// 对话后自动写入
async function onMessage(message: Message) {
  const content = `
Role: ${message.role}
Content: ${message.content}
Time: ${new Date().toISOString()}
  `;

  await writeToMemory('auto/messages/', content);
}
```

---

# 2. 统一搜索 (Unified Search)

## 核心思路

**grep 工具不仅搜文件，也搜 memory**：

```typescript
// 原来的 grep
{
  tool: "grep",
  params: {
    pattern: "xxx",
    path: "src/"
  }
}

// 返回
{
  files: [...],      // 文件搜索结果
  memory: [...]      // memory 搜索结果 ← 新增
}
```

## 返回格式

```typescript
{
  // 文件搜索结果
  files: [
    { path: "src/a.ts", lines: [...], matches: 2 },
    { path: "src/b.ts", lines: [...], matches: 1 }
  ],

  // Memory 搜索结果 ← 新增
  memory: [
    {
      source: "auto/tool_calls/xxx.md",
      snippet: "Tool: read\nParams: ...",
      score: 0.95,
      time: "2024-01-01"
    },
    {
      source: "auto/messages/xxx.md",
      snippet: "User: 那个问题...",
      score: 0.88,
      time: "2024-01-02"
    }
  ],

  // 统计
  total: {
    files: 2,
    memory: 5
  }
}
```

---

# 3. Grep 工具增强

## 参数

```typescript
{
  tool: "grep",
  params: {
    pattern: "xxx",          // 搜索内容
    path: "src/",           // 搜索路径（可选，默认当前目录）
    includeMemory: true,     // 是否同时搜索 memory（默认 true）
    memorySources: [        // 搜索哪些 memory 源
      "auto/tool_calls",
      "auto/messages",
      "notes"
    ],
    maxResults: 20          // 最大结果数
  }
}
```

---

# 4. Memory 内容来源

## 目录结构

```
storage/memory/
├── auto/                 # 自动写入
│   ├── tool_calls/       # 工具调用
│   │   └── 2024-01-01.md
│   ├── messages/         # 对话消息
│   │   └── 2024-01-01.md
│   ├── errors/          # 错误记录
│   └── ...
├── notes/               # 手动写入（LLM 自己写的）
│   └── ...
└── index/              # 向量索引
    └── memory.db
```

## 自动写入的内容

```markdown
# auto/tool_calls/2024-01-01.md

## 10:30:25
Tool: read
Params: {"path": "src/index.ts"}
Result: "..."

## 10:31:00
Tool: grep
Params: {"pattern": "TODO"}
Result: "..."

---

# auto/messages/2024-01-01.md

## 10:30:00
User: 帮我看看这个代码有什么问题

## 10:30:25
Assistant: 这个代码有...
```

---

# 5. System Prompt

```markdown
## 搜索系统

grep 工具会同时搜索：
1. 文件内容（workspace 目录）
2. 记忆库（自动记录的调用、对话等）

返回结果会标注来源：
- file: xxx.ts - 文件结果
- memory: auto/tool_calls - 记忆结果

## 记忆自动记录
- 工具调用会被自动记录
- 对话会被自动记录
- 你也可以手动写入 storage/memory/notes/

## 工作区
位置: storage/workspace/
- 需要读代码/文档/日志时直接读取
```

---

# 6. 优点

| 优点 | 说明 |
|-----|------|
| **自动积累** | 不需要 LLM 主动写，自动就有记忆 |
| **统一搜索** | 一个 grep 搞定文件和记忆 |
| **来源清晰** | 知道结果来自文件还是记忆 |
| **可追溯** | 记录了时间、来源 |

---

# 7. 实现要点

## 1. Hook 机制

```typescript
// 工具调用后自动记录
registerHook('afterToolCall', async (toolCall) => {
  await memory.write({
    type: 'tool_call',
    content: toolCall,
    timestamp: Date.now()
  });
});

// 对话后自动记录
registerHook('afterMessage', async (message) => {
  await memory.write({
    type: 'message',
    content: message,
    timestamp: Date.now()
  });
});
```

## 2. Grep 增强

```typescript
// 同时搜文件和 memory
async function grep(params) {
  const fileResults = await searchFiles(params);
  const memoryResults = await params.includeMemory
    ? await searchMemory(params)
    : [];

  return {
    files: fileResults,
    memory: memoryResults
  };
}
```

## 3. 向量索引

- 自动监视 `storage/memory/` 目录
- 文件变化自动更新索引

---

# 总结

| 功能 | 说明 |
|-----|------|
| **自动写入** | 工具调用、对话自动进 memory |
| **统一搜索** | grep 同时搜文件和 memory |
| **来源标注** | 返回结果标注来自哪里 |
| **工作区** | 只在 prompt 告知，LLM 主动读 |
