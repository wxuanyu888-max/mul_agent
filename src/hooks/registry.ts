// Hook 注册表 - 管理所有注册的钩子
import type { HookEventType, HookHandler, HookOptions } from "./types.js";

export class HookRegistry {
  private handlers: Map<HookEventType, HookHandler[]> = new Map();

  /**
   * 注册一个钩子
   */
  register(options: HookOptions): void {
    const { event, handler, priority = 0 } = options;

    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    const handlers = this.handlers.get(event)!;
    handlers.push({ event, handler, priority });

    // 按优先级排序
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 注销一个钩子
   */
  unregister(event: HookEventType, handler: (event: unknown) => Promise<void> | void): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.findIndex((h) => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 获取某个事件的所有钩子
   */
  getHandlers(event: HookEventType): HookHandler[] {
    return this.handlers.get(event) || [];
  }

  /**
   * 获取所有已注册的事件类型
   */
  getEventTypes(): HookEventType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 清空所有钩子
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * 清空某个事件的钩子
   */
  clearEvent(event: HookEventType): void {
    this.handlers.delete(event);
  }

  /**
   * 检查是否有钩子注册
   */
  hasHandlers(event: HookEventType): boolean {
    const handlers = this.handlers.get(event);
    return handlers !== undefined && handlers.length > 0;
  }
}

// 全局单例
export const globalHookRegistry = new HookRegistry();

/**
 * 便捷装饰器 - 注册钩子
 */
export function hook(_event: HookEventType, _priority?: number) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // 这里可以添加自动注册逻辑
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
