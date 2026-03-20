/**
 * OpenClaw Agent 类型定义
 *
 * 定义 Agent 执行流程中使用的核心类型
 */

/**
 * 消息来源渠道类型
 */
export type ChannelType =
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'web'
  | 'whatsapp'
  | 'signal'
  | 'line'
  | 'imessage';

/**
 * Agent 运行状态
 */
export enum AgentState {
  IDLE = 'idle',
  THINKING = 'thinking',
  EXECUTING = 'executing',
  WAITING = 'waiting',
  ERROR = 'error',
}

/**
 * Agent 运行配置
 */
export interface AgentRunConfig {
  sessionKey: string;
  channel: ChannelType;
  lane?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  extraSystemPrompt?: string;
  timeoutMs?: number;
}

/**
 * Agent 运行结果
 */
export interface AgentRunResult {
  runId: string;
  state: AgentState;
  messages: Message[];
  usage?: Usage;
  error?: string;
}

/**
 * 内容块类型 (用于 tool_result 等)
 */
export interface ContentBlock {
  type: 'text' | 'tool_result' | 'tool_use';
  text?: string;
  content?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * 消息类型
 * 支持多种格式以兼容不同 LLM 提供商
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  tool_call_id?: string;  // tool_result 时关联 tool_calls
  timestamp?: number;
}

/**
 * 统一的 Session 消息格式
 * 用于持久化和加载历史记录
 * 包含完整的 tool_use/tool_result 信息
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  tool_call_id?: string;  // tool_result 时关联 tool_calls
  name?: string;          // tool_result 时指定工具名
  timestamp?: number;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * 工具结果
 */
export interface ToolResult {
  toolCallId: string;
  output: string;
  isError?: boolean;
}

/**
 * 使用统计
 */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
}

/**
 * 会话条目
 */
export interface SessionEntry {
  sessionKey: string;
  accountId: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  state: AgentState;
  metadata?: Record<string, unknown>;
}

/**
 * 队列设置
 */
export interface QueueSettings {
  enabled: boolean;
  maxConcurrent: number;
  timeoutMs: number;
}

/**
 * Followup 运行
 */
export interface FollowupRun {
  runId: string;
  prompt: string;
  config: AgentRunConfig;
  workspaceDir?: string;
}

/**
 * 响应载荷
 */
export interface ReplyPayload {
  id: string;
  content: string;
  state: AgentState;
  toolCalls?: ToolCall[];
  usage?: Usage;
}

/**
 * 心跳检查结果
 */
export interface HeartbeatResult {
  needsAttention: boolean;
  message?: string;
}

/**
 * 工具定义
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresConfirmation?: boolean;
  gate?: ToolGate;
}

/**
 * 工具门条件
 */
export interface ToolGate {
  bins?: string[];
  env?: Record<string, string>;
  config?: Record<string, unknown>;
  os?: string[];
  always?: boolean;
}

/**
 * 块流式响应配置
 */
export interface BlockStreamingConfig {
  enabled: boolean;
  minChars?: number;
  maxChars?: number;
  breakPreference?: 'paragraph' | 'newline' | 'sentence';
  flushOnParagraph?: boolean;
}

/**
 * 响应模式
 */
export enum ReplyMode {
  NORMAL = 'normal',
  BLOCK = 'block',
  STREAM = 'stream',
}

/**
 * 输入来源
 */
export interface InputProvenance {
  kind: 'user' | 'inter_session' | 'heartbeat' | 'system';
  sourceSessionKey?: string;
  sourceChannel?: string;
  sourceTool?: string;
}

/**
 * Gateway 调用参数
 */
export interface GatewayCallParams {
  method: string;
  params: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * Gateway 调用结果
 */
export interface GatewayCallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 已加载的 skill/MCP 项
 */
export interface LoadedItem {
  type: 'skill' | 'mcp';
  name: string;
  content: string;      // skill 内容或 MCP 配置
  loadedAt: number;    // 加载时间戳
  lastUsedAt: number;   // 最后使用时间
}

// ============================================================================
// LLM 消息类型转换
// ============================================================================

/**
 * LLM 提供商使用的消息格式 (与 agents/llm.ts 保持一致)
 */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  tool_call_id?: string;
  name?: string;  // 用于 tool_result 消息（指定工具名）
}

/**
 * 将 Message[] 转换为 LLMMessage[] 用于 LLM 调用
 * 过滤掉 role 为 'system' 和 'tool' 的消息
 */
export function toLLMMessages(messages: Message[]): LLMMessage[] {
  return messages
    .filter((m): m is Message & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      tool_calls: m.toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })),
      tool_call_id: m.tool_call_id,
    }));
}
