/**
 * 心跳机制模块
 *
 * 负责定期检查 Agent 状态并处理提醒
 */

import { getCronManager } from '../tools/system/cron-manager.js';

/**
 * 心跳配置
 */
export interface HeartbeatConfig {
  intervalMs?: number;
  enabled?: boolean;
}

/**
 * 心跳检查器
 */
export class Heartbeat {
  private intervalMs: number;
  private enabled: boolean;
  private timer?: ReturnType<typeof setInterval>;
  private callback?: (result: HeartbeatResult) => void;

  constructor(config: HeartbeatConfig = {}) {
    this.intervalMs = config.intervalMs ?? 60000; // 默认 1 分钟
    this.enabled = config.enabled ?? true;
  }

  /**
   * 启动心跳
   */
  start(callback: (result: HeartbeatResult) => void): void {
    if (!this.enabled) {
      return;
    }

    this.callback = callback;
    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  /**
   * 停止心跳
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * 执行心跳检查
   */
  private async tick(): Promise<void> {
    if (!this.callback) {
      return;
    }

    try {
      const result = await this.check();
      this.callback(result);
    } catch (error) {
      console.error('Heartbeat tick error:', error);
    }
  }

  /**
   * 检查是否需要处理
   */
  async check(): Promise<HeartbeatResult> {
    // 1. 检查待处理的提醒
    const pendingReminders = await this.getPendingReminders();

    if (pendingReminders.length > 0) {
      return {
        needsAttention: true,
        message: this.formatReminderMessage(pendingReminders),
      };
    }

    // 2. 检查待执行的定时任务
    const pendingCronJobs = await this.getPendingCronJobs();

    if (pendingCronJobs.length > 0) {
      return {
        needsAttention: true,
        message: this.formatCronJobMessage(pendingCronJobs),
      };
    }

    // 3. 检查会话状态
    const sessionAlerts = await this.getSessionAlerts();

    if (sessionAlerts.length > 0) {
      return {
        needsAttention: true,
        message: this.formatSessionAlertMessage(sessionAlerts),
      };
    }

    // 无需处理
    return {
      needsAttention: false,
    };
  }

  /**
   * 获取待处理的提醒
   */
  private async getPendingReminders(): Promise<Reminder[]> {
    // 简化实现 - 实际应该从存储中读取
    return [];
  }

  /**
   * 获取待执行的定时任务
   */
  private async getPendingCronJobs(): Promise<CronJob[]> {
    try {
      const manager = getCronManager();
      const jobs = manager.listJobs();
      const now = Date.now();

      // 返回所有已到期的任务
      return jobs
        .filter(job => job.enabled && job.nextRun <= now)
        .map(job => ({
          id: job.id,
          name: job.label,
          schedule: job.schedule,
          nextRun: job.nextRun,
        }));
    } catch (error) {
      console.error('[Heartbeat] Failed to get pending cron jobs:', error);
      return [];
    }
  }

  /**
   * 获取会话告警
   */
  private async getSessionAlerts(): Promise<SessionAlert[]> {
    // 简化实现 - 实际应该检查会话状态
    return [];
  }

  /**
   * 格式化提醒消息
   */
  private formatReminderMessage(reminders: Reminder[]): string {
    if (reminders.length === 1) {
      return `Reminder: ${reminders[0].text}`;
    }
    return `You have ${reminders.length} pending reminders`;
  }

  /**
   * 格式化定时任务消息
   */
  private formatCronJobMessage(jobs: CronJob[]): string {
    if (jobs.length === 1) {
      return `Scheduled task: ${jobs[0].name}`;
    }
    return `You have ${jobs.length} scheduled tasks`;
  }

  /**
   * 格式化会话告警消息
   */
  private formatSessionAlertMessage(alerts: SessionAlert[]): string {
    return alerts.map(a => a.message).join('\n');
  }

  /**
   * 处理心跳响应
   */
  handleHeartbeatResponse(needsAttention: boolean, message?: string): string {
    if (!needsAttention) {
      return 'HEARTBEAT_OK';
    }

    return message ?? 'Attention required';
  }

  /**
   * 设置间隔时间
   */
  setInterval(ms: number): void {
    this.intervalMs = ms;
    if (this.timer) {
      this.stop();
      if (this.callback) {
        this.start(this.callback);
      }
    }
  }
}

/**
 * 提醒
 */
interface Reminder {
  id: string;
  text: string;
  dueAt: number;
}

/**
 * 定时任务
 */
interface CronJob {
  id: string;
  name: string;
  schedule: string;
  nextRun: number;
}

/**
 * 会话告警
 */
interface SessionAlert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * 创建心跳实例
 */
export function createHeartbeat(config?: HeartbeatConfig): Heartbeat {
  return new Heartbeat(config);
}

/**
 * 心跳结果
 */
export interface HeartbeatResult {
  needsAttention: boolean;
  message?: string;
}

/**
 * 心跳提示常量
 */
export const HEARTBEAT_OK = 'HEARTBEAT_OK';

/**
 * 解析心跳响应
 */
export function parseHeartbeatResponse(response: string): {
  isHeartbeatOk: boolean;
  message?: string;
} {
  const trimmed = response.trim();

  if (trimmed === HEARTBEAT_OK) {
    return {
      isHeartbeatOk: true,
    };
  }

  return {
    isHeartbeatOk: false,
    message: trimmed,
  };
}
