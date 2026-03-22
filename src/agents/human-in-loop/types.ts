/**
 * Human-in-the-Loop 类型定义
 *
 * 支持多种中断类型：确认、输入、选择、审查
 */

/**
 * 中断类型
 */
export type InterventionType = 'confirm' | 'input' | 'choice' | 'review';

/**
 * 中断状态
 */
export type InterventionState = 'pending' | 'approved' | 'rejected' | 'modified' | 'timeout';

/**
 * 人工干预请求
 */
export interface HumanIntervention {
  id: string;
  sessionId: string;
  agentId: string;
  type: InterventionType;
  message: string;
  options?: string[];
  defaultValue?: string;
  state: InterventionState;
  response?: string;
  createdAt: number;
  respondedAt?: number;
  timeoutAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 中断触发条件
 */
export type InterruptTrigger = 'tool' | 'llm' | 'iteration' | 'custom';

/**
 * 中断配置
 */
export interface InterruptConfig {
  /** 唯一标识 */
  id: string;
  /** 触发条件 */
  trigger: InterruptTrigger;
  /** 匹配模式（工具名、正则表达式等） */
  match?: string | RegExp;
  /** 中断类型 */
  type: InterventionType;
  /** 提示消息模板 */
  message: string;
  /** 选项列表（用于 choice 类型） */
  options?: string[];
  /** 默认值（用于 input 类型） */
  defaultValue?: string;
  /** 超时时间 (ms) */
  timeoutMs?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 优先级（数字越大优先级越高） */
  priority?: number;
}

/**
 * 干预请求上下文
 */
export interface InterventionContext {
  sessionId: string;
  agentId: string;
  phase: 'llm' | 'tool' | 'iteration';
  iteration: number;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  model?: string;
  messageCount?: number;
  additionalInfo?: Record<string, unknown>;
}

/**
 * 干预响应
 */
export interface InterventionResponse {
  interventionId: string;
  action: 'approve' | 'reject' | 'modify' | 'timeout';
  response?: string;
  modifiedInput?: Record<string, unknown>;
}

/**
 * 干预统计
 */
export interface InterventionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  timeout: number;
  avgResponseTimeMs: number;
}
