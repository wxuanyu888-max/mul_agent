// Hooks 模块 - 统一导出
export * from "./types.js";
export * from "./registry.js";
export * from "./executor.js";
export * from "./predefined.js";

// 便捷函数 - 快速注册hook
import { globalHookRegistry, HookRegistry } from "./registry.js";
import { defaultHookExecutor, HookExecutor, emit } from "./executor.js";

/**
 * 注册一个hook的便捷方法
 */
export function registerHook(
  event: string,
  handler: (event: any) => Promise<void> | void,
  options?: { priority?: number }
): void {
  globalHookRegistry.register({
    event: event as any,
    handler,
    priority: options?.priority,
  });
}

/**
 * 触发hook的便捷方法
 */
export const trigger = emit;

/**
 * 创建新的hook注册表
 */
export const createHookRegistry = () => new HookRegistry();

/**
 * 创建新的hook执行器
 */
export const createHookExecutor = (options?: { registry?: HookRegistry; continueOnError?: boolean }) =>
  new HookExecutor(options);

// ==================== 预定义钩子点 ====================

/**
 * Agent 生命周期钩子
 */
export const AgentHooks = {
  start: "agent.start",
  end: "agent.end",
  bootstrap: "agent.bootstrap",
  error: "agent.error",
} as const;

/**
 * Session 生命周期钩子
 */
export const SessionHooks = {
  start: "session.start",
  end: "session.end",
  pause: "session.pause",
  resume: "session.resume",
} as const;

/**
 * Message 生命周期钩子
 */
export const MessageHooks = {
  received: "message.received",
  beforeProcess: "message.before_process",
  afterProcess: "message.after_process",
  beforeResponse: "message.before_response",
  afterResponse: "message.after_response",
} as const;

/**
 * Tool 生命周期钩子
 */
export const ToolHooks = {
  beforeCall: "tool.before_call",
  afterCall: "tool.after_call",
  error: "tool.error",
} as const;

/**
 * Memory 生命周期钩子
 */
export const MemoryHooks = {
  beforeSave: "memory.before_save",
  afterSave: "memory.after_save",
  beforeRecall: "memory.before_recall",
  afterRecall: "memory.after_recall",
} as const;
