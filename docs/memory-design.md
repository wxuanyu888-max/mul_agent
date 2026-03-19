/**
 * MulAgent 记忆系统重新设计方案
 *
 * 基于 OpenClaw 设计原则的四层记忆架构
 */

# 整体架构

```
storage/
├── memory/
│   ├── MEMORY.md           # 长期记忆（重要决策、偏好、持久事实）
│   ├── memory/             # 每日日志
│   │   └── YYYY-MM-DD.md
│   └── sessions/           # 会话历史（可选）
│       └── session_xxx.jsonl
├── workspace/              # 工作文件（Agent 主动读取）
│   ├── docs/
│   ├── data/
│   └── logs/
└── remote.json            # Remote Memory（直接加载的配置）
```

---

# 四层记忆设计

## 1. Short Memory (短期记忆)

**来源**: 当前会话消息
**存储**: 内存 + SQLite
**加载方式**: 直接追加到上下文

```typescript
// 每次 LLM 调用时加载最近 N 条消息
const shortMemory = await session.getRecentMessages(50);
```

**典型内容**:
- 当前会话的对话历史
- 最近的操作结果

---

## 2. Remote Memory (远程记忆)

**来源**: `storage/remote.json`
**存储**: JSON 文件
**加载方式**: 每次会话开始时加载

```typescript
// 会话开始时加载
const remote = await loadRemoteMemory();
```

**典型内容**:
- Agent 角色定义
- 系统扩展配置
- 用户偏好设置
- API 密钥等敏感配置

```json
// storage/remote.json 示例
{
  "agent_role": "你是一个专业的代码审查助手...",
  "user_preferences": {
    "language": "中文",
    "code_style": "Google"
  },
  "system_extensions": []
}
```

---

## 3. Vector Memory (向量记忆)

**来源**: `storage/memory/MEMORY.md` + `storage/memory/memory/*.md`
**存储**: SQLite + 向量
**加载方式**: semantic search top-k

```typescript
// 查询时按需检索
const results = await vectorSearch(query, { maxResults: 5 });
```

**典型内容**:
- 重要决策记录
- 项目架构信息
- 代码模式和规范
- 之前解决的问题

**特点**:
- 混合搜索: BM25 (关键词) + Vector (语义)
- 自动文件监视 + 索引更新
- 支持多种 Embedding Provider (OpenAI / Gemini / Voyage / Mistral / Ollama / **Offline**)

---

## 4. Workspace (工作区)

**来源**: `storage/workspace/` 目录
**存储**: 文件系统
**加载方式**: Agent 主动读取

```typescript
// Agent 决定是否读取
const files = await listWorkspaceFiles();
const content = await readFile('storage/workspace/docs/xxx.md');
```

**典型内容**:
- 原始数据文件
- 日志文件
- 文档
- 项目代码

---

# 何时写入记忆

| 触发条件 | 写入位置 | 记忆类型 |
|---------|---------|---------|
| 用户说 "记住这个" | `MEMORY.md` | Vector |
| 重要决策 | `MEMORY.md` | Vector |
| 每日工作笔记 | `memory/YYYY-MM-DD.md` | Vector |
| 用户偏好 | `remote.json` | Remote |
| Agent 角色定义 | `remote.json` | Remote |
| 会话历史 | sessions/*.jsonl | Short |

---

# 自动刷新机制 (Pre-Compaction)

在上下文快压缩前（预留 tokens 低于阈值时），触发静默的 agent turn：

```typescript
// 当 context 接近压缩阈值时
if (tokensRemaining < MEMORY_FLUSH_THRESHOLD) {
  // 静默触发，agent 不会看到这个消息
  await agent.silentRun({
    prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store."
  });
}
```

---

# API 设计

## 现有工具

```typescript
// Memory 工具（统一入口）
{
  action: "write",     // 写入记忆
  action: "search",    // 语义搜索
  action: "get",       // 读取文件
}

// 参数
{
  action: "write",
  content: "重要的信息...",
  memory_type: "short_term" | "long_term" | "daily",
  path: "custom_path.md"  // 可选
}
```

## 建议新增工具

```typescript
// Remote Memory 工具
{
  tool: "remote_memory",
  action: "get",       // 获取远程配置
  action: "set",       // 设置远程配置
  key: "agent_role"    // 配置 key
}

// Workspace 工具
{
  tool: "workspace",
  action: "list",      // 列出文件
  action: "read",      // 读取文件
  action: "write"     // 写入文件
}
```

---

# Embedding Provider 配置

```typescript
const MEMORY_CONFIG = {
  // 优先级: offline > local > remote
  provider: 'auto',  // 自动选择可用 provider
  fallback: 'offline',

  // Remote 配置
  remote: {
    baseUrl: '...',
    apiKey: '...'
  },

  // Local 配置
  local: {
    modelPath: './models/bge-small-zh-v1.5.gguf'
  }
};
```

---

# 文件结构

```
src/
├── memory/
│   ├── index.ts              # 导出入口
│   ├── unified.ts            # 统一记忆管理器
│   ├── manager.ts            # 向量索引管理
│   ├── database.ts           # SQLite 数据库
│   ├── hybrid.ts             # 混合搜索
│   ├── embeddings/
│   │   ├── index.ts          # Provider 工厂
│   │   ├── offline.ts        # Offline (TF-IDF) ⬅️ 已实现
│   │   ├── openai.ts
│   │   ├── ollama.ts
│   │   └── ...
│   ├── routes.ts             # API 路由
│   └── types.ts              # 类型定义
│
├── tools/
│   └── memory/
│       ├── index.ts          # 统一工具入口
│       ├── search.ts         # 搜索实现
│       ├── write.ts          # 写入实现
│       └── get.ts            # 读取实现
```

---

# 总结

| 记忆层 | 存储 | 加载方式 | 典型场景 |
|-------|-----|---------|---------|
| **Short** | 内存/SQLite | 每次请求 | 当前会话 |
| **Remote** | JSON 文件 | 会话开始 | Agent 配置 |
| **Vector** | SQLite+向量 | 语义搜索 | 重要记忆 |
| **Workspace** | 文件系统 | Agent 主动 | 原始数据 |

**核心原则** (来自 OpenClaw):
1. 文件是真相的唯一来源
2. 如果用户说"记住这个"，立即写入
3. 如果想让信息持久化，让 agent 写入记忆
4. 上下文压缩前自动刷新记忆
