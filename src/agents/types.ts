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
 * 消息类型
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
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
