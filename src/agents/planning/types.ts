/**
 * 自主规划模块类型定义
 *
 * 定义目标、任务、规划结果等核心类型
 */

/**
 * 子任务状态
 */
export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * 目标状态
 */
export type GoalStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'planning';

/**
 * 子任务
 */
export interface Subtask {
  /** 子任务 ID */
  id: string;
  /** 子任务描述 */
  description: string;
  /** 状态 */
  status: SubtaskStatus;
  /** 执行结果 */
  result?: string;
  /** 依赖的子任务 ID */
  dependencies: string[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 尝试次数 */
  attempts: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 目标
 */
export interface Goal {
  /** 目标 ID */
  id: string;
  /** 原始用户请求 */
  originalRequest: string;
  /** 目标描述 */
  description: string;
  /** 状态 */
  status: GoalStatus;
  /** 子任务列表 */
  subtasks: Subtask[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 当前正在执行的子任务 ID */
  currentSubtaskId?: string;
}

/**
 * 规划结果
 */
export interface PlanningResult {
  /** 目标 */
  goal: Goal;
  /** LLM 的规划理由 */
  reasoning: string;
  /** 是否需要用户确认 */
  needsReprompt: boolean;
  /** 原始 LLM 响应 */
  rawResponse?: string;
}

/**
 * 反思结果
 */
export interface ReflectionResult {
  /** 进度评估 (0-100) */
  progressScore: number;
  /** 当前方向是否正确 */
  isOnTrack: boolean;
  /** 问题列表 */
  issues: string[];
  /** 建议 */
  suggestions: string[];
  /** 是否需要重新规划 */
  needsReplanning: boolean;
  /** 反思详情 */
  reasoning: string;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  /** 当前目标 */
  goal: Goal;
  /** 当前消息历史 */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** 已执行的迭代次数 */
  iterations: number;
  /** 当前轮次 */
  conversationRound: number;
}

/**
 * 规划配置
 */
export interface PlanningConfig {
  /** 最大子任务数量 */
  maxSubtasks?: number;
  /** 反思触发阈值（每 N 轮反思一次） */
  reflectionInterval?: number;
  /** 是否启用自我反思 */
  enableReflection?: boolean;
  /** 是否启用元认知 */
  enableMetaCognition?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 复杂任务阈值（超过此数量词认为是复杂任务） */
  complexityThreshold?: number;
}

/**
 * 反思触发条件
 */
export type ReflectionTrigger =
  | 'iteration' // 按迭代次数
  | 'subtask_complete' // 子任务完成
  | 'error' // 发生错误
  | 'manual'; // 手动触发

/**
 * 元认知结果
 */
export interface MetacognitionResult {
  /** 推理质量评分 (0-100) */
  reasoningQuality: number;
  /** 策略建议 */
  strategyAdjustment?: string;
  /** 是否需要改变方法 */
  needsApproachChange: boolean;
  /** 观察到的模式 */
  observedPatterns: string[];
  /** 建议的工具使用策略 */
  suggestedToolStrategy?: string;
}

/**
 * 目标追踪器接口
 */
export interface IGoalTracker {
  /** 初始化目标 */
  initializeGoal(goal: Goal): void;
  /** 获取当前目标 */
  getCurrentGoal(): Goal | undefined;
  /** 获取下一个可执行的子任务 */
  getNextExecutableSubtasks(): Subtask[];
  /** 更新子任务状态 */
  updateSubtaskStatus(
    subtaskId: string,
    status: SubtaskStatus,
    result?: string,
    error?: string
  ): void;
  /** 检查目标是否完成 */
  isGoalComplete(): boolean;
  /** 获取所有失败的子任务 */
  getFailedSubtasks(): Subtask[];
  /** 重置目标 */
  reset(): void;
}

/**
 * 规划器接口
 */
export interface IPlanner {
  /** 创建规划 */
  createPlan(userMessage: string): Promise<PlanningResult>;
  /** 优化规划 */
  refinePlan(goal: Goal, executionResult: string): Promise<Goal>;
  /** 分析任务复杂度 */
  analyzeComplexity(description: string): number;
}

/**
 * 反思器接口
 */
export interface IReflector {
  /** 执行反思 */
  reflect(context: ExecutionContext): Promise<ReflectionResult>;
  /** 执行元认知 */
  metacognize(context: ExecutionContext): Promise<MetacognitionResult>;
}
