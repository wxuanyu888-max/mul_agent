// 预定义的 Hook Handlers
import type { HookEvent, HookEventType, HookHandler, HookOptions } from "./types.js";

/**
 * 创建一个带优先级的hook handler
 */
export function createHookHandler(
  event: HookEventType,
  handler: (event: HookEvent) => Promise<void> | void,
  options: { priority?: number; enabled?: boolean } = {}
): HookHandler {
  return {
    event,
    handler,
    priority: options.priority || 0,
    enabled: options.enabled !== false,
  };
}

// ==================== 常用 Hook 工厂函数 ====================

/**
 * 日志钩子 - 记录所有事件
 */
export function createLoggingHook(eventType: HookEventType): HookHandler {
  return {
    event: eventType,
    handler: async (event: HookEvent) => {
      console.log(`[Hook] ${event.type}`, {
        sessionId: event.context.sessionId,
        userId: event.context.userId,
        timestamp: new Date(event.timestamp).toISOString(),
      });
    },
    priority: -100, // 低优先级，最后执行
  };
}

/**
 * 指标钩子 - 记录事件指标
 */
export function createMetricsHook(eventType: HookEventType): HookHandler {
  const metrics: Record<string, number> = {};

  return {
    event: eventType,
    handler: async (event: HookEvent) => {
      const key = event.type;
      metrics[key] = (metrics[key] || 0) + 1;
      console.log(`[Metrics] ${key}: ${metrics[key]}`);
    },
    priority: -200,
  };
}

/**
 * 错误处理钩子
 */
export function createErrorHandlerHook(): HookHandler {
  return {
    event: "agent.error" as HookEventType,
    handler: async (event: HookEvent) => {
      console.error(`[Error] Agent error:`, event.context.data?.error);
    },
    priority: 100, // 高优先级
  };
}

/**
 * Session 启动钩子
 */
export function createSessionStartHook(
  handler: (sessionId: string, userId?: string) => Promise<void> | void
): HookHandler {
  return {
    event: "session.start",
    handler: async (event: HookEvent) => {
      await handler(event.context.sessionId || "", event.context.userId);
    },
  };
}

/**
 * Session 结束钩子
 */
export function createSessionEndHook(
  handler: (sessionId: string, messageCount?: number) => Promise<void> | void
): HookHandler {
  return {
    event: "session.end",
    handler: async (event: HookEvent) => {
      await handler(
        event.context.sessionId || "",
        event.context.data?.messageCount
      );
    },
  };
}

/**
 * Message 接收钩子
 */
export function createMessageReceivedHook(
  handler: (message: string, context: HookEvent["context"]) => Promise<void> | void
): HookHandler {
  return {
    event: "message.received",
    handler: async (event: HookEvent) => {
      await handler(event.context.data?.message || "", event.context);
    },
  };
}

/**
 * Tool 调用前钩子
 */
export function createBeforeToolHook(
  handler: (toolName: string, params: Record<string, unknown>) => Promise<void> | void
): HookHandler {
  return {
    event: "tool.before_call",
    handler: async (event: HookEvent) => {
      await handler(
        event.context.data?.toolName as string || "",
        event.context.data?.params as Record<string, unknown> || {}
      );
    },
  };
}

/**
 * Tool 调用后钩子
 */
export function createAfterToolHook(
  handler: (toolName: string, result: unknown) => Promise<void> | void
): HookHandler {
  return {
    event: "tool.after_call",
    handler: async (event: HookEvent) => {
      await handler(
        event.context.data?.toolName || "",
        event.context.data?.result || {}
      );
    },
  };
}
