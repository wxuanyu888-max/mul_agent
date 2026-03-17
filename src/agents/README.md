# OpenClaw Agent 执行流程

> OpenClaw Agent 核心执行流程详解

---

## 1. 消息接收 (Message Ingestion)

OpenClaw 通过多种渠道接收用户消息：

| 渠道 | 目录 | 文件数 |
|------|------|--------|
| Telegram | `openclaw/telegram/` | 125 |
| Discord | `openclaw/discord/` | 73 |
| Slack | `openclaw/slack/` | 60 |
| Web | `openclaw/web/` | 42 |
| WhatsApp | `openclaw/whatsapp/` | 6 |
| Signal | `openclaw/signal/` | 28 |
| Line | `openclaw/line/` | 45 |

消息被统一路由到相应的处理程序，转换为内部格式。

---

## 2. 会话管理 (Session Management)

### 核心文件
- `openclaw/config/sessions.js` - 会话存储和加载
- `openclaw/agents/session-identity.ts` - 会话身份管理

### 会话流程
```
用户消息 → sessionKey → 加载会话 → 更新会话 → 保存会话
```

- 根据 `sessionKey` 加载或创建会话
- 维护会话历史和上下文
- 支持会话压缩 (compaction) 以控制 token 使用

---

## 3. Agent 执行核心

### 入口函数：`runReplyAgent()`

**文件位置**: `openclaw/auto-reply/reply/agent-runner.ts`

```typescript
export async function runReplyAgent(params: {
  commandBody: string;
  followupRun: FollowupRun;
  queueKey: string;
  resolvedQueue: QueueSettings;
  shouldSteer: boolean;
  shouldFollowup: boolean;
  isActive: boolean;
  isStreaming: boolean;
  // ...
}): Promise<ReplyPayload | ReplyPayload[] | undefined>
```

### 执行步骤

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Execution Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. runReplyAgent()                                         │
│     ├── 参数解析 (commandBody, followupRun, queueSettings)  │
│     ├── 会话初始化 (sessionEntry, sessionStore)             │
│     ├── Heartbeat 检查 (isHeartbeat)                        │
│     └── 工具结果/输出过滤配置                               │
│          ↓                                                  │
│  2. runAgentTurnWithFallback()                             │
│     ├── 发送消息到 Gateway                                 │
│     ├── 处理 fallback 逻辑                                   │
│     └── 响应处理                                            │
│          ↓                                                  │
│  3. runAgentStep()                                         │
│     ├── callGateway("agent") - 发起请求                    │
│     ├── callGateway("agent.wait") - 等待完成               │
│     └── readLatestAssistantReply() - 读取回复              │
│          ↓                                                  │
│  4. 工具循环 (Tool Loop)                                   │
│     ├── Agent 决定调用工具                                  │
│     ├── 执行 bash/read/write/search 等工具                 │
│     └── 重复直到完成                                        │
│          ↓                                                  │
│  5. 响应处理                                               │
│     ├── buildReplyPayloads() - 构建响应                     │
│     ├── 处理块流式响应                                      │
│     └── 打字提示信号                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 核心函数详解

#### 3.1 runAgentStep()

**文件位置**: `openclaw/agents/tools/agent-step.ts`

```typescript
export async function runAgentStep(params: {
  sessionKey: string;
  message: string;
  extraSystemPrompt: string;
  timeoutMs: number;
  channel?: string;
  lane?: string;
}): Promise<string | undefined>
```

执行流程：
1. 生成唯一 `stepIdem` (UUID)
2. 调用 `callGateway("agent")` 发起请求
3. 调用 `callGateway("agent.wait")` 等待完成
4. 调用 `readLatestAssistantReply()` 读取回复

---

## 4. 工具循环 (Tool Loop)

### 支持的工具

| 工具 | 描述 | 是否需要确认 |
|------|------|-------------|
| `bash` | 执行 bash 命令 | ✅ |
| `read` | 读取文件 | ❌ |
| `write` | 写入文件 | ✅ |
| `edit` | 编辑文件 | ✅ |
| `search` | 搜索文件 | ❌ |
| `glob` | 文件查找 | ❌ |
| `grep` | 内容搜索 | ❌ |

### 后台执行支持

```typescript
// 启动后台任务
bash pty:true background:true command:"codex exec 'task'"

// 监控进度
process action:log sessionId:XXX

// 检查状态
process action:poll sessionId:XXX

// 发送输入
process action:submit sessionId:XXX data:"yes"

// 终止任务
process action:kill sessionId:XXX
```

### PTY 模式

- **Codex/Pi/OpenCode**: 必须使用 `pty:true`
- **Claude Code**: 使用 `--print --permission-mode bypassPermissions`

---

## 5. 响应处理 (Response Handling)

### 文件位置
- `openclaw/auto-reply/reply/agent-runner-payloads.ts`
- `openclaw/auto-reply/reply/agent-runner-helpers.ts`

### 处理流程

1. **构建响应载荷** (`buildReplyPayloads`)
2. **块流式响应** - 支持分块传输
3. **打字提示** - `createTypingSignaler`
4. **后续运行** (`createFollowupRunner`)

---

## 6. 会话结束 (Session End)

### 清理任务

```typescript
// 记忆刷新
runMemoryFlushIfNeeded()

// 使用统计
persistRunSessionUsage()

// 压缩计数
incrementRunCompactionCount()
```

### 文件位置
- `openclaw/auto-reply/reply/agent-runner-memory.ts`
- `openclaw/auto-reply/reply/session-run-accounting.ts`

---

## 7. 心跳机制 (Heartbeat)

### 文件位置
- `openclaw/storage/prompts/system/heartbeats.md`

### 心跳流程

```
系统 → 发送心跳请求 → Agent 检查状态
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
        无需处理                         需要处理
              ↓                               ↓
    返回 "HEARTBEAT_OK"              返回提醒/警告
```

### 响应格式

```
# 无需处理时
HEARTBEAT_OK

# 需要处理时
[具体提醒内容]
```

---

## 8. 核心文件索引

| 功能 | 文件位置 |
|------|----------|
| 入口 | `openclaw/entry.ts` |
| Agent 运行器 | `openclaw/auto-reply/reply/agent-runner.ts` |
| Agent 步骤 | `openclaw/agents/tools/agent-step.ts` |
| Gateway 调用 | `openclaw/gateway/call.ts` |
| 会话管理 | `openclaw/config/sessions.ts` |
| 系统提示 | `openclaw/storage/prompts/system/*.md` |
| 工具定义 | `openclaw/agents/bash-tools.ts` |
| 工具循环检测 | `openclaw/agents/tool-loop-detection.ts` |

---

## 9. 流程图

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   消息接收    │────▶│  会话管理    │────▶│  Agent 执行  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                     ┌────────────────────────────┘
                     ↓
              ┌──────────────┐
              │   工具循环    │◀─────┐
              └──────────────┘      │
                     │              │
                     └──────────────┘
                     ↓
              ┌──────────────┐     ┌──────────────┐
              │  响应处理    │────▶│  会话结束    │
              └──────────────┘     └──────────────┘
                     │
                     ↓
              ┌──────────────┐
              │    心跳      │
              └──────────────┘
```
