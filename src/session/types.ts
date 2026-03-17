// Session 模块类型定义

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * 消息内容
 */
export interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  content?: string;
}

/**
 * 消息
 */
export interface Message {
  role: MessageRole;
  content: MessageContent | MessageContent[];
  name?: string;
  id?: string;
  timestamp?: number;
}

/**
 * Session 状态
 */
export type SessionStatus = 'active' | 'idle' | 'completed' | 'error';

/**
 * Session 配置
 */
export interface SessionConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
  runtime?: 'main' | 'subagent';
  timeoutSeconds?: number;
}

/**
 * Session 元数据
 */
export interface SessionMetadata {
  id: string;
  label?: string;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  config: SessionConfig;
}

/**
 * Session 完整数据
 */
export interface Session extends SessionMetadata {
  messages: Message[];
  toolCalls: ToolCall[];
  usage?: TokenUsage;
}

/**
 * 工具调用记录
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  output?: string;
  timestamp: number;
  duration?: number;
}

/**
 * Token 使用量
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * Session 创建选项
 */
export interface CreateSessionOptions {
  label?: string;
  parentId?: string;
  config?: SessionConfig;
}

/**
 * Session 查询选项
 */
export interface QuerySessionsOptions {
  status?: SessionStatus;
  parentId?: string;
  label?: string;
  limit?: number;
  offset?: number;
}
