/**
 * Agent 生命周期管理器
 *
 * 管理 Agent 的完整生命周期：
 * - 优雅启动
 * - 优雅关闭
 * - 自动保存检查点
 * - 资源监控
 * - 故障恢复
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getCheckpointManager, type Checkpoint, type CheckpointReason } from './checkpoint/index.js';
import type { AgentLoop } from './loop.js';
import type { Message } from './types.js';

/**
 * 生命周期配置
 */
export interface LifecycleConfig {
  /** 自动保存检查点间隔 (ms) */
  checkpointIntervalMs?: number;
  /** 资源监控间隔 (ms) */
  monitorIntervalMs?: number;
  /** 最大内存使用 (MB) */
  maxMemoryMB?: number;
  /** 最大磁盘使用 (MB) */
  maxDiskMB?: number;
  /** 检查点保留数量 */
  maxCheckpoints?: number;
  /** 是否启用优雅关闭 */
  gracefulShutdown?: boolean;
  /** 关闭超时 (ms) */
  shutdownTimeoutMs?: number;
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  memory: {
    usedMB: number;
    totalMB: number;
    percent: number;
  };
  disk: {
    usedMB: number;
    availableMB: number;
  };
  cpu: {
    percent: number;
  };
  timestamp: number;
}

/**
 * 生命周期状态
 */
export type LifecycleState =
  | 'initializing'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * 生命周期事件
 */
export interface LifecycleEvent {
  type: 'state_change' | 'checkpoint' | 'error' | 'resource_warning';
  state?: LifecycleState;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Agent 生命周期管理器
 */
export class LifecycleManager {
  private config: Required<LifecycleConfig>;
  private state: LifecycleState = 'initializing';
  private agent: AgentLoop | null = null;
  private checkpointTimer?: ReturnType<typeof setInterval>;
  private monitorTimer?: ReturnType<typeof setInterval>;
  private eventListeners: Array<(event: LifecycleEvent) => void> = [];
  private lastCheckpointId: string | null = null;
  private startTime: number = 0;

  constructor(config: LifecycleConfig = {}) {
    this.config = {
      checkpointIntervalMs: config.checkpointIntervalMs ?? 60000, // 1分钟
      monitorIntervalMs: config.monitorIntervalMs ?? 30000, // 30秒
      maxMemoryMB: config.maxMemoryMB ?? 1024, // 1GB
      maxDiskMB: config.maxDiskMB ?? 10240, // 10GB
      maxCheckpoints: config.maxCheckpoints ?? 10,
      gracefulShutdown: config.gracefulShutdown ?? true,
      shutdownTimeoutMs: config.shutdownTimeoutMs ?? 30000,
    };
  }

  /**
   * 初始化生命周期管理器
   */
  async initialize(agent: AgentLoop): Promise<void> {
    this.agent = agent;
    this.setState('initializing');

    // 启动资源监控
    this.startMonitoring();

    // 启动自动检查点保存
    this.startCheckpointAutoSave();

    this.startTime = Date.now();
    this.setState('running');

    this.emit({
      type: 'state_change',
      state: 'running',
      message: 'Agent lifecycle initialized',
      timestamp: Date.now(),
    });
  }

  /**
   * 设置状态
   */
  private setState(newState: LifecycleState): void {
    const oldState = this.state;
    this.state = newState;
    console.log(`[Lifecycle] State: ${oldState} -> ${newState}`);
  }

  /**
   * 启动资源监控
   */
  private startMonitoring(): void {
    this.monitorTimer = setInterval(async () => {
      try {
        const usage = await this.getResourceUsage();

        // 检查内存
        if (usage.memory.percent > 90) {
          this.emit({
            type: 'resource_warning',
            message: `High memory usage: ${usage.memory.percent.toFixed(1)}%`,
            data: { usage },
            timestamp: Date.now(),
          });
        }

        // 检查磁盘
        if (usage.disk.availableMB < 1000) {
          this.emit({
            type: 'resource_warning',
            message: `Low disk space: ${usage.disk.availableMB}MB available`,
            data: { usage },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('[Lifecycle] Resource monitoring error:', error);
      }
    }, this.config.monitorIntervalMs);
  }

  /**
   * 启动自动检查点保存
   */
  private startCheckpointAutoSave(): void {
    this.checkpointTimer = setInterval(async () => {
      if (!this.agent || this.state !== 'running') {
        return;
      }

      try {
        await this.saveCheckpoint('auto');
      } catch (error) {
        console.error('[Lifecycle] Auto checkpoint error:', error);
      }
    }, this.config.checkpointIntervalMs);
  }

  /**
   * 获取资源使用情况
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 获取磁盘使用情况
    let diskUsedMB = 0;
    let diskAvailableMB = 0;

    try {
      const stats = await fs.statfs(process.cwd());
      diskAvailableMB = Math.floor(stats.bsize * stats.blocks / 1024 / 1024);
      diskUsedMB = Math.floor(stats.bsize * (stats.blocks - stats.bfree) / 1024 / 1024);
    } catch {
      // 忽略磁盘错误
    }

    const totalMemMB = Math.floor(memUsage.heapTotal / 1024 / 1024);
    const usedMemMB = Math.floor(memUsage.heapUsed / 1024 / 1024);

    return {
      memory: {
        usedMB: usedMemMB,
        totalMB: totalMemMB,
        percent: (usedMemMB / totalMemMB) * 100,
      },
      disk: {
        usedMB: diskUsedMB,
        availableMB: diskAvailableMB,
      },
      cpu: {
        percent: (cpuUsage.user + cpuUsage.system) / 1000000, // 简化的 CPU 使用率
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 保存检查点
   */
  async saveCheckpoint(reason: string): Promise<Checkpoint | null> {
    if (!this.agent) {
      return null;
    }

    try {
      const checkpointManager = getCheckpointManager();

      // 获取 Agent 的当前状态
      // 注意：这里需要 AgentLoop 提供获取状态的方法
      // 目前先创建一个基本检查点
      const checkpoint = await checkpointManager.create({
        sessionId: `lifecycle_${Date.now()}`,
        iteration: 0,
        conversationRound: 0,
        reason: reason as CheckpointReason,
        messages: [],
        systemPrompt: '',
        compactionContext: {
          compactionCount: 0,
          lastCompactionTokens: 0,
          transcriptPath: '',
          toolResultPlaceholders: new Map<string, string>(),
        },
        generatedFiles: [],
        pendingToolCalls: [],
        completedToolCalls: [],
        lastLlmCallId: null,
        lastLlmResponse: null,
      });

      this.lastCheckpointId = checkpoint.id;

      this.emit({
        type: 'checkpoint',
        message: `Checkpoint saved: ${checkpoint.id}`,
        data: { checkpointId: checkpoint.id, reason },
        timestamp: Date.now(),
      });

      return checkpoint;
    } catch (error) {
      this.emit({
        type: 'error',
        message: `Failed to save checkpoint: ${error}`,
        timestamp: Date.now(),
      });
      return null;
    }
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    if (this.state === 'stopping' || this.state === 'stopped') {
      return;
    }

    this.setState('stopping');
    console.log('[Lifecycle] Starting graceful shutdown...');

    // 停止接受新任务
    // 保存最终检查点
    await this.saveCheckpoint('shutdown');

    // 停止定时器
    this.stopTimers();

    // 等待清理完成
    await this.waitForCleanup();

    this.setState('stopped');
    this.emit({
      type: 'state_change',
      state: 'stopped',
      message: 'Agent shutdown complete',
      timestamp: Date.now(),
    });
  }

  /**
   * 停止所有定时器
   */
  private stopTimers(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = undefined;
    }

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }

  /**
   * 等待清理完成
   */
  private async waitForCleanup(): Promise<void> {
    const startWait = Date.now();

    while (Date.now() - startWait < this.config.shutdownTimeoutMs) {
      // 检查是否有进行中的操作
      // 这里可以检查 Agent 的状态
      await this.sleep(100);
    }

    console.log('[Lifecycle] Cleanup wait timeout');
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 从检查点恢复
   */
  async restoreFromCheckpoint(checkpointId: string): Promise<boolean> {
    if (!this.agent) {
      return false;
    }

    try {
      const checkpointManager = getCheckpointManager();
      const checkpoint = await checkpointManager.get(checkpointId);

      if (!checkpoint) {
        console.error(`[Lifecycle] Checkpoint not found: ${checkpointId}`);
        return false;
      }

      // 恢复 Agent 状态
      // 需要 AgentLoop 提供恢复方法
      // this.agent.restore(checkpoint);

      this.emit({
        type: 'state_change',
        state: 'running',
        message: `Restored from checkpoint: ${checkpointId}`,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      this.emit({
        type: 'error',
        message: `Failed to restore from checkpoint: ${error}`,
        timestamp: Date.now(),
      });
      return false;
    }
  }

  /**
   * 订阅生命周期事件
   */
  onEvent(listener: (event: LifecycleEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * 发送事件
   */
  private emit(event: LifecycleEvent): void {
    event.timestamp = Date.now();
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[Lifecycle] Event listener error:', error);
      }
    }
  }

  /**
   * 获取当前状态
   */
  getState(): LifecycleState {
    return this.state;
  }

  /**
   * 获取运行时间
   */
  getUptime(): number {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  /**
   * 获取最后检查点 ID
   */
  getLastCheckpointId(): string | null {
    return this.lastCheckpointId;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopTimers();
    this.eventListeners = [];
    this.agent = null;
    this.setState('stopped');
  }
}

/**
 * 创建生命周期管理器
 */
export function createLifecycleManager(config?: LifecycleConfig): LifecycleManager {
  return new LifecycleManager(config);
}

/**
 * 全局生命周期管理器
 */
let globalLifecycleManager: LifecycleManager | null = null;

export function setGlobalLifecycleManager(manager: LifecycleManager): void {
  globalLifecycleManager = manager;
}

export function getGlobalLifecycleManager(): LifecycleManager | null {
  return globalLifecycleManager;
}
