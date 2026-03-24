# 解决方案：agents/loop.ts 测试重写

> 创建时间：2026-03-22
> 版本：v1

---

## 1. 模块概述

`agents/loop.ts` 是 Agent 核心循环模块，实现 LLM + Tools 的完整 Agent 循环。

---

## 2. 公开 API

### 2.1 类：`AgentLoop`

#### 构造函数
```typescript
constructor(config: AgentLoopConfig = {})
```

**输入 (AgentLoopConfig)**：
| 字段 | 类型 | 必填 | 默认值 | 约束 |
|-----|------|------|-------|------|
| `maxIterations` | number | 否 | 20 | > 0, <= 1000 |
| `timeoutMs` | number | 否 | 300000 | > 0 |
| `workspaceDir` | string | 否 | process.cwd() | 必须是有效路径 |
| `sessionId` | string | 否 | '' | - |
| `fileRefreshInterval` | number | 否 | 10 | > 0 |
| `extraSystemPrompt` | string | 否 | '' | - |
| `promptMode` | 'full' \| 'minimal' \| 'none' | 否 | 'full' | 枚举值 |
| `onToolConfirm` | (tool: ToolCall) => Promise<boolean> | 否 | () => true | - |
| `onToolExecute` | (tool: ToolCall, result: AgentToolResult) => void | 否 | () => {} | - |
| `onLlmCall` | (messages, systemPrompt) => void | 否 | () => {} | - |
| `onLlmResponse` | (response: LLMResponse) => void | 否 | () => {} | - |
| `compaction` | CompactionConfig | 否 | {} | - |
| `onManualCompact` | (messages: Message[]) => Promise<void> | 否 | () => {} | - |

**输出**：AgentLoop 实例

---

#### registerTool(tool: RegisteredTool): void

**输入 (RegisteredTool)**：
```typescript
{
  name: string;           // 工具名称，必填
  description: string;     // 工具描述
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation?: boolean;
}
```

**输出**：void

**约束**：
- `name` 不能为空
- `name` 不能重复注册（后者覆盖前者）
- `execute` 抛出错误时由 AgentLoop 捕获

---

#### registerTools(tools: RegisteredTool[]): void

**输入**：RegisteredTool 数组

**输出**：void

**约束**：
- 内部调用 `registerTool`，受相同约束

---

#### registerDefaultTools(): void

**输入**：无

**输出**：void

**约束**：
- 会创建默认工具集并注册
- 内部调用 `registerTools`

---

#### getLoadedItems(): LoadedItem[]

**输入**：无

**输出**：LoadedItem 数组

**约束**：
- 返回所有已加载的 skill/MCP

---

#### getConversationRound(): number

**输入**：无

**输出**：当前对话轮次（从 1 开始）

**约束**：
- 每次 `run()` 调用递增

---

#### async run(params: { message: string; history?: Message[] }): Promise<AgentLoopResult>

**输入**：
| 字段 | 类型 | 必填 | 约束 |
|-----|------|------|------|
| `message` | string | 是 | 非空 |
| `history` | Message[] | 否 | - |

**输出 (AgentLoopResult)**：
```typescript
{
  content: string;        // 最终回复内容
  success: boolean;       // 是否成功
  iterations: number;      // 迭代次数
  toolCalls: number;      // 工具调用次数
  error?: string;          // 错误信息（如果失败）
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  messages?: Array<{...}>; // 完整消息历史
}
```

**约束和分支场景**：

| 场景 | 输入条件 | 期望输出 |
|-----|---------|---------|
| 正常完成 | LLM 返回非 tool_use stop_reason | success=true, content=文本 |
| 工具调用 | LLM 返回 tool_use stop_reason | 执行工具后继续循环 |
| 无工具调用 | tool_use 但提取不到 tool_calls | success=true, content=提示信息 |
| 工具不存在 | tool.name 不在注册表中 | 返回错误结果的 tool message |
| 工具执行失败 | tool.execute 抛出异常 | isError=true 的结果 |
| 手动压缩 | tool.name === 'compact' | 执行 manualCompact |
| 自动压缩 | token 超过 autoCompactThreshold | 执行 autoCompact |
| 达到最大迭代 | iterations >= maxIterations | success=false, error='Max iterations reached' |
| LLM 调用失败 | llm.chat 抛出异常 | success=false, error=错误信息 |

---

#### async triggerCompact(): Promise<void>

**输入**：无

**输出**：void

**约束**：
- 目前只是记录日志，外部调用点

---

### 2.2 函数

#### createAgentLoop(config?: AgentLoopConfig): AgentLoop

**输入**：可选的 AgentLoopConfig

**输出**：AgentLoop 实例

**约束**：等同于 `new AgentLoop(config)`

---

#### runAgent(params: {...}): Promise<AgentLoopResult>

**输入**：
```typescript
{
  message: string;           // 必填
  history?: Message[];       // 可选
  maxIterations?: number;    // 可选
  workspaceDir?: string;     // 可选
  extraSystemPrompt?: string; // 可选
  promptMode?: 'full' | 'minimal' | 'none'; // 可选
}
```

**输出**：AgentLoopResult

**约束**：
- 创建 AgentLoop 后自动注册默认工具
- 启动时同步工作区到向量库

---

## 3. 内部方法（需要 Mock 测试）

| 方法 | 输入 | 输出 | 约束 |
|-----|------|------|------|
| `buildPrompt()` | 无 | string (systemPrompt) | 依赖 loadSkills, buildSystemPrompt |
| `loadSkills()` | 无 | SkillInfo[] | 依赖 loadSkillsFromDir, getEnabledSkills |
| `getToolDefinitions()` | 无 | LLMRequest['tools'] | - |
| `extractTextContent(response)` | LLMResponse | string | - |
| `extractToolCalls(response)` | LLMResponse | ToolCall[] | 处理两种格式 |
| `executeTool(toolCall)` | ToolCall | AgentToolResult | 捕获工具异常 |
| `injectBackgroundNotifications(messages)` | Message[] | Message[] | - |
| `trackGeneratedFiles(toolName, output)` | string, string | void | 只追踪特定工具 |

---

## 4. Mock 策略

| 依赖模块 | Mock 方式 |
|---------|----------|
| `llm.ts` (getLLMClient) | 创建 FakeLLMClient 返回预设响应 |
| `prompt/builder.ts` (buildSystemPrompt) | 直接 Mock 该模块 |
| `tools/index.js` (createDefaultTools) | Mock 该模块 |
| `compaction.ts` | 直接 Mock 该模块 |
| `background.ts` (getBackgroundManager) | Mock 该模块 |
| `skills/index.ts` (loadSkillsFromDir) | Mock 该模块 |
| `skills/manager.ts` (getEnabledSkills) | Mock 该模块 |

---

## 5. 测试用例设计

### 5.1 构造函数测试

| 测试名称 | 输入 | 期望 | 验证点 |
|---------|------|------|-------|
| `should_apply_default_config` | {} | 内部 config 正确 | maxIterations=20, timeoutMs=300000 等 |
| `should_apply_custom_maxIterations` | {maxIterations: 5} | maxIterations=5 | - |
| `should_apply_custom_timeoutMs` | {timeoutMs: 60000} | timeoutMs=60000 | - |
| `should_apply_custom_workspaceDir` | {workspaceDir: '/test'} | workspaceDir='/test' | - |
| `should_apply_custom_promptMode` | {promptMode: 'minimal'} | promptMode='minimal' | - |
| `should_use_default_values_for_undefined` | {maxIterations: undefined} | maxIterations=20 | 正确处理 undefined |

### 5.2 registerTool 测试

| 测试名称 | 输入 | 期望 | 验证点 |
|---------|------|------|-------|
| `should_register_tool` | mockTool | 工具可被获取 | tools.get(name) 返回工具 |
| `should_overwrite_existing_tool` | 同名 tool | 后者覆盖前者 | - |
| `should_store_all_properties` | 完整 tool 对象 | 属性完整保留 | name, description, parameters, execute |

### 5.3 registerTools 测试

| 测试名称 | 输入 | 期望 | 验证点 |
|---------|------|------|-------|
| `should_register_multiple_tools` | [tool1, tool2] | 全部可获取 | tools.get(tool1.name), tools.get(tool2.name) |
| `should_call_registerTool_for_each` | [t1, t2, t3] | 正确调用3次 | 验证 registerTool 被调用3次 |

### 5.4 run() 核心场景测试

| 测试名称 | 场景 | LLM 响应 | 期望输出 |
|---------|------|---------|---------|
| `should_return_text_response` | 普通文本回复 | stop_reason='stop', content='Hello' | success=true, content='Hello' |
| `should_execute_tool_and_continue` | 需要调用工具 | stop_reason='tool_use', tool_calls=[{name:'read',...}] | 执行工具，继续循环 |
| `should_return_error_when_tool_not_found` | 工具未注册 | stop_reason='tool_use', tool_calls=[{name:'unknown'}] | tool result 包含 error |
| `should_handle_tool_execution_error` | 工具执行失败 | stop_reason='tool_use', tool_calls=[{name:'read'}] | tool result isError=true |
| `should_reject_tool_when_confirm_returns_false` | 确认回调返回 false | stop_reason='tool_use' | 添加拒绝消息，不执行工具 |
| `should_trigger_manual_compact_on_compact_tool` | 调用 compact 工具 | stop_reason='tool_use', tool_calls=[{name:'compact'}] | 调用 manualCompact |
| `should_return_max_iterations_error` | 达到最大迭代 | 持续返回 tool_use | success=false, error='Max iterations reached' |
| `should_return_llm_error_on_exception` | LLM 抛出异常 | - | success=false, error=异常消息 |
| `should_count_tokens_from_response` | 任何响应 | usage={input_tokens:100,output_tokens:50} | usage.inputTokens=100 |

### 5.5 getLoadedItems / getConversationRound 测试

| 测试名称 | 场景 | 期望 |
|---------|------|------|
| `should_return_empty_initially` | 新建 AgentLoop | getLoadedItems=[] |
| `should_return_conversation_round` | 初始状态 | getConversationRound=0 |
| `should_increment_round_after_run` | 调用 run() | getConversationRound=1 |

---

## 6. 验收标准

- [ ] 所有公开方法有测试覆盖
- [ ] 所有分支场景被测试
- [ ] Mock 使用 Fake 替代直接 Mock
- [ ] 无 `as any` 类型断言
- [ ] 真实断言（不只是 toBeDefined）
- [ ] 测试名称清晰描述场景

---

## 7. 目录结构

重写后的测试文件：
```
tests/src/agents/
├── loop.test.ts      # AgentLoop 完整测试 (41 tests, 100% pass)
├── types.test.ts     # 类型定义测试
├── loop.fake.ts      # Test fakes 和 helpers
└── fixtures/         # 测试固件（如果需要）
```

## 8. 完成状态

| 任务 | 状态 | 测试数 | 通过率 |
|-----|------|-------|-------|
| T1: agents/loop.ts | ✅ 完成 | 41 | 100% |
| T2: agents/llm.ts | ✅ 完成 | 29 | 100% |
| T3: agents/tools.ts | ✅ 完成 | 25 | 100% |
| T12: tools/types.ts | ✅ 完成 | 7 | 100% |
| T13-T15: tools/file/* | ⚠️ 已有测试(需改进) | - | - |

---

## 9. 已完成测试统计

### agents/ 模块
- `loop.test.ts` - 41 tests ✓
- `llm.test.ts` - 29 tests ✓
- `tools.test.ts` - 25 tests ✓

### tools/ 模块
- `tools/types.test.ts` - 7 tests ✓
- `file/read.test.ts` - 已有（需改进）
- `file/write.test.ts` - 已有（需改进）

### 总计：102 个新测试通过

---

## 10. 下一个模块：src/agents/prompt/builder.ts

### 公开 API

#### class LLMClient

```typescript
class LLMClient {
  constructor()
  async chat(request: LLMRequest): Promise<LLMResponse>
  async chatSimple(userMessage: string, systemPrompt?: string, tools?: LLMRequest['tools']): Promise<string>
  async chatWithContext(userMessage: string, history: Message[], systemPrompt?: string, tools?: LLMRequest['tools']): Promise<string>
}
```

#### 函数

```typescript
function getLLMClient(): LLMClient
function chat(userMessage: string, systemPrompt?: string, tools?: LLMRequest['tools']): Promise<string>
function chatWithContext(userMessage: string, history: Message[], systemPrompt?: string, tools?: LLMRequest['tools']): Promise<string>
```

### 输入输出

#### chat(request: LLMRequest)

**输入 (LLMRequest)**：
```typescript
{
  messages: LLMMessage[];      // 必填，消息数组
  model?: string;             // 可选，模型名称
  temperature?: number;       // 可选，0-2 之间
  max_tokens?: number;        // 可选，最大 token 数
  stream?: boolean;           // 可选，是否流式
}
```

**输出 (LLMResponse)**：
```typescript
{
  content: Array<{ type: 'text' | 'tool_use'; text?: string; id?: string; name?: string; input?: unknown }>;
  model: string;
  stop_reason?: 'stop' | 'tool_use' | 'end_turn' | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

**约束**：
- messages 必填且非空
- temperature 应该在 0-2 之间
- 需要有效的 API key

**错误场景**：
- API key 缺失或无效
- 网络错误
- 模型不支持
- rate limit

### 测试用例设计

| 测试名称 | 场景 | 输入 | 期望输出 |
|---------|------|------|---------|
| `should_send_correct_request_structure` | 基本调用 | messages=[{role:'user', content:'hi'}] | 调用 provider.chat |
| `should_pass_temperature_to_provider` | temperature 参数 | temperature=0.5 | provider 收到 0.5 |
| `should_pass_max_tokens_to_provider` | max_tokens 参数 | max_tokens=1000 | provider 收到 1000 |
| `should_return_text_content` | 普通文本响应 | provider 返回 text | content[0].text |
| `should_return_tool_calls` | 工具调用响应 | provider 返回 tool_use | stop_reason='tool_use' |
| `should_aggregate_usage` | token 使用统计 | 响应包含 usage | usage.input_tokens + output_tokens |
| `should_throw_without_api_key` | 缺少 API key | 无 API key | Error: API key required |
| `should_handle_network_error` | 网络错误 | 网络故障 | Error: Network error |
| `should_handle_rate_limit` | 速率限制 | 429 响应 | Error: Rate limit exceeded |
| `chatSimple_should_concat_messages` | 简单聊天 | userMessage + systemPrompt | messages 包含两者 |
| `chatWithContext_should_prepend_history` | 带历史聊天 | userMessage + history | messages 以 history 开头 |
