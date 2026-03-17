// Hook 类型定义
export type HookEventType =
  // Agent 生命周期
  | "agent.start"
  | "agent.end"
  | "agent.bootstrap"
  | "agent.error"
  // Session 生命周期
  | "session.start"
  | "session.end"
  | "session.pause"
  | "session.resume"
  // Message 生命周期
  | "message.received"
  | "message.before_process"
  | "message.after_process"
  | "message.before_response"
  | "message.after_response"
  // Tool 生命周期
  | "tool.before_call"
  | "tool.after_call"
  | "tool.error"
  // Memory 生命周期
  | "memory.before_save"
  | "memory.after_save"
  | "memory.before_recall"
  | "memory.after_recall";

export interface HookContext {
  sessionId?: string;
  sessionKey?: string;
  agentId?: string;
  userId?: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface HookEvent {
  type: HookEventType;
  source: string;
  context: HookContext;
  timestamp: number;
}

export interface HookHandler {
  event: HookEventType;
  handler: (event: HookEvent) => Promise<void> | void;
  priority?: number;
  enabled?: boolean;
}

export interface HookOptions {
  event: HookEventType;
  handler: (event: HookEvent) => Promise<void> | void;
  priority?: number;
}

export type HookResult = {
  success: boolean;
  error?: string;
};
