/**
 * Cron Job Manager - 定时任务管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { notificationSystem } from './notification.js';
import { getCronPath } from '../../utils/path.js';

// SSE 事件发送函数（延迟导入以避免循环依赖）
let sendSSEToCronSession: ((eventType: string, data: Record<string, unknown>) => void) | null = null;

export function setCronSSECallback(callback: (eventType: string, data: Record<string, unknown>) => void): void {
  sendSSEToCronSession = callback;
}

export interface CronJob {
  id: string;
  label: string;
  schedule: string; // cron 表达式
  task: string; // 任务内容
  createdAt: number;
  nextRun: number; // 下次执行时间
  enabled: boolean;
  sessionId?: string; // 关联的 session ID（可选）
  agentId?: string; // 关联的 agent ID（可选）
}

// Cron 表达式解析 (简化版)
// 支持: min hour day month dow
// 例如: "50 22 * * *" = 每天 22:50
function parseCronExpression(schedule: string, now: number): number {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return now + 60000; // 无效则 1 分钟后

  const [min, hour, day, month, dow] = parts;
  const date = new Date(now);

  // 先设置为当前时间
  date.setSeconds(0, 0);

  // 解析分钟
  if (min === '*') {
    // * 表示每分钟，返回当前时间 + 1 分钟
    return now + 60000;
  }

  // 设置目标分钟
  const targetMin = parseInt(min);
  date.setMinutes(targetMin);

  // 解析小时
  if (hour !== '*') {
    date.setHours(parseInt(hour));
  } else {
    // 如果小时是 *，当前小时已过则加1小时
    if (date.getTime() <= now) {
      date.setHours(date.getHours() + 1);
    }
  }

  // 解析日期（可选）
  if (day !== '*') {
    date.setDate(parseInt(day));
  }

  // 解析月份（可选）
  if (month !== '*') {
    date.setMonth(parseInt(month) - 1); // 月份从 0 开始
  }

  // 如果设置的时间已经过去（不管是分钟还是小时的问题），推到下一天
  if (date.getTime() <= now) {
    date.setDate(date.getDate() + 1);
  }

  return date.getTime();
}

export class CronManager {
  private jobsDir: string;
  private jobs: Map<string, CronJob> = new Map();
  private callbacks: Array<(job: CronJob) => void> = [];
  private checkInterval?: ReturnType<typeof setInterval>;

  constructor(jobsDir?: string) {
    this.jobsDir = jobsDir || getCronPath();
    this.ensureDir();
    this.loadJobs();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.jobsDir)) {
      fs.mkdirSync(this.jobsDir, { recursive: true });
    }
  }

  private loadJobs(): void {
    try {
      const files = fs.readdirSync(this.jobsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(this.jobsDir, file), 'utf-8');
          const job = JSON.parse(content) as CronJob;
          this.jobs.set(job.id, job);
        }
      }
      console.log(`[CronManager] Loaded ${this.jobs.size} cron jobs`);
    } catch (error) {
      console.error('[CronManager] Failed to load jobs:', error);
    }
  }

  private saveJob(job: CronJob): void {
    const filePath = path.join(this.jobsDir, `${job.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
  }

  private deleteJobFile(jobId: string): void {
    const filePath = path.join(this.jobsDir, `${jobId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  createJob(label: string, schedule: string, task: string, sessionId?: string, agentId?: string): CronJob {
    const id = `cron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const job: CronJob = {
      id,
      label,
      schedule,
      task,
      createdAt: now,
      nextRun: parseCronExpression(schedule, now),
      enabled: true,
      sessionId,
      agentId,
    };

    this.jobs.set(id, job);
    this.saveJob(job);
    console.log(`[CronManager] Created job: ${label}, next run: ${new Date(job.nextRun).toLocaleString()}`);

    return job;
  }

  deleteJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    this.jobs.delete(id);
    this.deleteJobFile(id);
    console.log(`[CronManager] Deleted job: ${job.label}`);

    return true;
  }

  listJobs(): CronJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => a.nextRun - b.nextRun);
  }

  getJob(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  onJobExecute(callback: (job: CronJob) => void): void {
    this.callbacks.push(callback);
  }

  start(): void {
    if (this.checkInterval) return;

    // 每分钟检查一次
    this.checkInterval = setInterval(() => {
      this.checkAndExecute();
    }, 60000);

    // 启动时立即检查一次
    this.checkAndExecute();
    console.log('[CronManager] Started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log('[CronManager] Stopped');
    }
  }

  private checkAndExecute(): void {
    const now = Date.now();

    for (const [id, job] of this.jobs) {
      if (!job.enabled) continue;

      if (job.nextRun <= now) {
        // 输出醒目日志
        console.log('\n========================================');
        console.log(`🔔 [定时提醒] ${job.label}`);
        console.log(`📝 ${job.task}`);
        console.log(`⏰ 执行时间: ${new Date(now).toLocaleString()}`);
        console.log('========================================\n');

        // 发送通知
        notificationSystem.add('cron', job.label, job.task);

        // 通过 SSE 发送事件给前端
        if (sendSSEToCronSession) {
          sendSSEToCronSession('cron_notification', {
            id: job.id,
            label: job.label,
            task: job.task,
            scheduledFor: new Date(now).toISOString(),
            nextRun: new Date(job.nextRun).toLocaleString(),
            sessionId: job.sessionId,
            agentId: job.agentId,
          });
        }

        // 触发回调
        for (const callback of this.callbacks) {
          callback(job);
        }

        // 计算下次执行时间
        job.nextRun = parseCronExpression(job.schedule, now);
        this.saveJob(job);

        console.log(`[CronManager] Job ${job.label} next run: ${new Date(job.nextRun).toLocaleString()}`);
      }
    }
  }
}

// 全局单例
let globalCronManager: CronManager | null = null;

export function getCronManager(): CronManager {
  if (!globalCronManager) {
    globalCronManager = new CronManager();
    globalCronManager.start();
  }
  return globalCronManager;
}
