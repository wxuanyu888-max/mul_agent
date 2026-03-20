// Hook 执行器 - 触发钩子事件
import type { HookEvent, HookEventType, HookContext } from "./types.js";
import { globalHookRegistry, HookRegistry } from "./registry.js";

export interface HookExecutorOptions {
  registry?: HookRegistry;
  continueOnError?: boolean;
}

export class HookExecutor {
  private registry: HookRegistry;
  private continueOnError: boolean;

  constructor(options: HookExecutorOptions = {}) {
    this.registry = options.registry || globalHookRegistry;
    this.continueOnError = options.continueOnError ?? true;
  }

  /**
   * 触发一个钩子事件
   */
  async emit(eventType: HookEventType, context: Partial<HookContext>): Promise<void> {
    const event: HookEvent = {
      type: eventType,
      source: "system",
      context: {
        ...context,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const handlers = this.registry.getHandlers(eventType);

    if (handlers.length === 0) {
      return;
    }

    for (const hook of handlers) {
      try {
        if (hook.enabled !== false) {
          await hook.handler(event);
        }
      } catch (error) {
        if (!this.continueOnError) {
          throw error;
        }
        console.error(`Hook error on ${eventType}:`, error);
      }
    }
  }

  /**
   * 创建带上下文的执行器
   */
  withContext(_context: Partial<HookContext>): HookExecutor {
    return new HookExecutor({
      registry: this.registry,
      continueOnError: this.continueOnError,
    });
  }
}

// 默认执行器
export const defaultHookExecutor = new HookExecutor();

// 便捷函数
export const emit = (eventType: HookEventType, context?: Partial<HookContext>) =>
  defaultHookExecutor.emit(eventType, context || {});
