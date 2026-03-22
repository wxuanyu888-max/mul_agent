/**
 * 降级策略管理器
 *
 * 实现故障自动降级：
 * - LLM Provider 降级
 * - 功能降级
 * - 自动恢复
 */

import type { LLMProvider } from '../providers/types.js';

/**
 * 降级级别
 */
export type DegradationLevel = 'normal' | 'degraded' | 'minimal' | 'emergency';

/**
 * 降级配置
 */
export interface DegradationConfig {
  /** 最大连续失败次数触发降级 */
  maxFailures?: number;
  /** 降级检查间隔 (ms) */
  checkIntervalMs?: number;
  /** 是否启用自动恢复 */
  autoRecovery?: boolean;
  /** 恢复检查间隔 (ms) */
  recoveryIntervalMs?: number;
}

/**
 * 组件状态
 */
export interface ComponentState {
  name: string;
  status: 'healthy' | 'degraded' | 'failed';
  failureCount: number;
  lastFailure?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 降级策略
 */
export interface DegradationStrategy {
  level: DegradationLevel;
  description: string;
  actions: Array<() => void | Promise<void>>;
}

/**
 * 降级策略管理器
 */
export class DegradationManager {
  private config: Required<DegradationConfig>;
  private currentLevel: DegradationLevel = 'normal';
  private components: Map<string, ComponentState> = new Map();
  private strategies: Map<DegradationLevel, DegradationStrategy> = new Map();
  private checkTimer?: ReturnType<typeof setInterval>;
  private recoveryTimer?: ReturnType<typeof setInterval>;
  private listeners: Array<(level: DegradationLevel, reason: string) => void> = [];

  constructor(config: DegradationConfig = {}) {
    this.config = {
      maxFailures: config.maxFailures ?? 3,
      checkIntervalMs: config.checkIntervalMs ?? 5000,
      autoRecovery: config.autoRecovery ?? true,
      recoveryIntervalMs: config.recoveryIntervalMs ?? 30000,
    };

    // 注册默认策略
    this.registerDefaultStrategies();
  }

  /**
   * 注册默认降级策略
   */
  private registerDefaultStrategies(): void {
    // 正常 - 完整功能
    this.strategies.set('normal', {
      level: 'normal',
      description: 'Full functionality',
      actions: [],
    });

    // 降级 - 减少功能
    this.strategies.set('degraded', {
      level: 'degraded',
      description: 'Reduced functionality - disabled some features',
      actions: [
        () => console.log('[Degradation] Enabled degraded mode'),
      ],
    });

    // 最小 - 核心功能
    this.strategies.set('minimal', {
      level: 'minimal',
      description: 'Minimal functionality - core features only',
      actions: [
        () => console.log('[Degradation] Enabled minimal mode'),
      ],
    });

    // 紧急 - 仅保存状态
    this.strategies.set('emergency', {
      level: 'emergency',
      description: 'Emergency mode - save state only',
      actions: [
        () => console.log('[Degradation] Enabled emergency mode'),
      ],
    });
  }

  /**
   * 注册组件
   */
  registerComponent(name: string): void {
    this.components.set(name, {
      name,
      status: 'healthy',
      failureCount: 0,
    });
  }

  /**
   * 标记组件失败
   */
  markFailure(componentName: string, error?: unknown): void {
    const component = this.components.get(componentName);
    if (!component) {
      this.registerComponent(componentName);
      return;
    }

    component.failureCount++;
    component.lastFailure = Date.now();
    component.status = 'failed';

    console.log(`[Degradation] Component ${componentName} failed (${component.failureCount} times)`);

    // 检查是否需要降级
    this.checkDegradation();
  }

  /**
   * 标记组件恢复
   */
  markRecovery(componentName: string): void {
    const component = this.components.get(componentName);
    if (!component) {
      return;
    }

    component.failureCount = 0;
    component.status = 'healthy';

    console.log(`[Degradation] Component ${componentName} recovered`);

    // 检查是否可以恢复
    this.checkRecovery();
  }

  /**
   * 检查是否需要降级
   */
  private checkDegradation(): void {
    let maxFailures = 0;

    for (const component of this.components.values()) {
      if (component.status === 'failed') {
        maxFailures = Math.max(maxFailures, component.failureCount);
      }
    }

    // 确定降级级别
    let newLevel: DegradationLevel = 'normal';

    if (maxFailures >= this.config.maxFailures * 3) {
      newLevel = 'emergency';
    } else if (maxFailures >= this.config.maxFailures * 2) {
      newLevel = 'minimal';
    } else if (maxFailures >= this.config.maxFailures) {
      newLevel = 'degraded';
    }

    // 如果级别变化，应用策略
    if (newLevel !== this.currentLevel) {
      this.applyStrategy(newLevel);
    }
  }

  /**
   * 检查是否可以恢复
   */
  private checkRecovery(): void {
    if (!this.config.autoRecovery) {
      return;
    }

    // 检查所有组件是否健康
    let allHealthy = true;
    for (const component of this.components.values()) {
      if (component.status !== 'healthy') {
        allHealthy = false;
        break;
      }
    }

    // 如果所有组件健康，尝试恢复到正常模式
    if (allHealthy && this.currentLevel !== 'normal') {
      // 等待一段时间后再恢复，避免频繁切换
      setTimeout(() => {
        this.applyStrategy('normal');
      }, this.config.recoveryIntervalMs);
    }
  }

  /**
   * 应用降级策略
   */
  private applyStrategy(level: DegradationLevel): void {
    const oldLevel = this.currentLevel;
    const strategy = this.strategies.get(level);

    if (!strategy) {
      console.error(`[Degradation] Unknown level: ${level}`);
      return;
    }

    this.currentLevel = level;
    console.log(`[Degradation] Level: ${oldLevel} -> ${level}: ${strategy.description}`);

    // 执行策略操作
    for (const action of strategy.actions) {
      try {
        action();
      } catch (error) {
        console.error('[Degradation] Strategy action error:', error);
      }
    }

    // 通知监听器
    for (const listener of this.listeners) {
      try {
        listener(level, strategy.description);
      } catch (error) {
        console.error('[Degradation] Listener error:', error);
      }
    }
  }

  /**
   * 手动设置降级级别
   */
  setLevel(level: DegradationLevel): void {
    this.applyStrategy(level);
  }

  /**
   * 获取当前降级级别
   */
  getLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * 获取组件状态
   */
  getComponentState(name: string): ComponentState | undefined {
    return this.components.get(name);
  }

  /**
   * 获取所有组件状态
   */
  getAllComponentStates(): ComponentState[] {
    return Array.from(this.components.values());
  }

  /**
   * 注册降级级别变更监听器
   */
  onLevelChange(listener: (level: DegradationLevel, reason: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 启动自动检查
   */
  startAutoCheck(): void {
    this.checkTimer = setInterval(() => {
      this.checkDegradation();
    }, this.config.checkIntervalMs);
  }

  /**
   * 停止自动检查
   */
  stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopAutoCheck();
    this.listeners = [];
    this.components.clear();
  }
}

/**
 * 创建降级管理器
 */
export function createDegradationManager(config?: DegradationConfig): DegradationManager {
  return new DegradationManager(config);
}

/**
 * 全局降级管理器
 */
let globalDegradationManager: DegradationManager | null = null;

export function setGlobalDegradationManager(manager: DegradationManager): void {
  globalDegradationManager = manager;
}

export function getGlobalDegradationManager(): DegradationManager | null {
  return globalDegradationManager;
}

/**
 * 便捷函数：创建并初始化全局降级管理器
 */
export function initGlobalDegradationManager(config?: DegradationConfig): DegradationManager {
  const manager = createDegradationManager(config);
  manager.registerComponent('llm');
  manager.registerComponent('memory');
  manager.registerComponent('tools');
  manager.registerComponent('storage');
  setGlobalDegradationManager(manager);
  return manager;
}
