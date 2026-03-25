// API Types

export interface ChatRequest {
  message: string;
  agent_id?: string;
  conversation_id?: string;
}

export interface ChatResponse {
  response: string;
  route?: string;
  conversation_id?: string;
}

export interface Agent {
  agent_id: string;
  name: string;
  description: string;
  role: string | Record<string, unknown>;
  status?: string;
  project_id?: string;
}

export interface AgentConfig {
  metadata?: Record<string, unknown>;
  content: string;
}

export interface Memory {
  id: string;
  content: string | {
    key?: string;
    value: string;
    metadata?: Record<string, unknown>;
  };
  timestamp?: number;
  created_at?: string;
  updated_at?: string;
  type?: string;
}

export interface LogEntry {
  message: string;
  datetime?: string;
  source?: string;
  level?: string;
  trace_id?: string;
  run_id?: string;
}

export interface AgentSummary {
  total_runs: number;
  success: number;
  failed: number;
  error: number;
  avg_duration: number;
  route_stats: Record<string, number>;
}

export interface Route {
  name: string;
  description: string;
}

export interface Project {
  project_id: string;
  name: string;
  description: string;
  created_at: string;
  agent_count: number;
}

export interface ProjectDetails {
  project_id: string;
  name: string;
  description: string;
  created_at: string;
  agents: Agent[];
}

// Token Usage Types
export interface TokenUsageSummary {
  agent_id: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  access_count: number;
  last_access_time: string | null;
  updated_at: string | null;
}

export interface ModelTokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  access_count: number;
}

export interface FunctionTokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  access_count: number;
}

export interface DateTokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  access_count: number;
}

export interface ToolCall {
  name: string;
  input: string;
  output?: string;
}

export interface LLMCallLog {
  timestamp: string;
  model: string;
  function: string;
  input_tokens: number;
  output_tokens: number;
  input_text?: string; // 输入文本（完整）
  output_text?: string; // 输出文本（完整）
  context_sources?: string[]; // 上下文来源地址列表（加载文件列表）
  tool_calls?: ToolCall[]; // 工具调用列表
  // 兼容旧格式
  extra?: {
    input?: string;
    output?: string;
    [key: string]: any;
  };
}

export interface TokenUsageDetails {
  summary: TokenUsageSummary;
  details: {
    by_model: Record<string, ModelTokenStats>;
    by_function: Record<string, FunctionTokenStats>;
    by_date: Record<string, DateTokenStats>;
  };
  llm_logs: LLMCallLog[]; // LLM 调用日志（在根级别）
}

export interface AllAgentsTokenUsage {
  [agent_id: string]: TokenUsageSummary;
}

// Integration Settings Types
export interface Integration {
  id: string;
  name: string;
  url: string;
  provider: string;
  model?: string;
  icon?: string;
  status: "active" | "inactive";
  has_key: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface IntegrationFormData {
  name: string;
  url: string;
  provider: string;
  model?: string;
  key?: string;
  icon?: string;
}

// Chat Message Types
export type AttachmentStatus = 'pending' | 'uploading' | 'parsing' | 'done' | 'error';

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string;
  // 解析状态
  status?: AttachmentStatus;
  extractedText?: string;
  error?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  agentId?: string;      // 广播模式下表示是哪个 agent 的回复
  agentName?: string;    // agent 的显示名称
}

export interface ApiMessage {
  role: string;
  content: string;
  timestamp?: string;
}

// Agent Interaction Types
export interface Interaction {
  run_id: string;
  source: string;
  target: string;
  type: string;
  task: string;
  status: string;
  timestamp: number;
  datetime?: string;
}

export interface InteractionHistoryModalProps {
  source: string;
  target: string;
  edgeId?: string;
  onClose: () => void;
}

// Task Types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

export interface Task {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  priority?: number;     // Lower number = higher priority
  owner?: string;
  blockedBy: string[];  // IDs of tasks that block this task
  blocks: string[];     // IDs of tasks that this task blocks
  createdAt: number;
  updatedAt: number;
}

export interface TaskFormData {
  subject: string;
  description: string;
  priority?: number;
  owner?: string;
  blockedBy?: string[];
}
