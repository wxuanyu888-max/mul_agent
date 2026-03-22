/**
 * Cron Job Manager - 定时任务管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { notificationSystem } from './notification.js';
import { getCronPath } from '../../utils/path.js';

export interface CronJob {
  id: string;
  label: string;
  schedule: string; // cron 表达式
  task: string; // 任务内容
  createdAt: number;
  nextRun: number; // 下次执行时间
  enabled: boolean;
}

// Cron 表达式解析 (简化版)
function parseCronExpression(schedule: string, now: number): number {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return now + 3600000; // 无效则 1 小时后

  const [min, hour, day, month, dow] = parts;
  const date = new Date(now);

  // 解析分钟
  if (min !== '*') {
    date.setMinutes(parseInt(min), 0, 0);
  } else {
    date.setMinutes(0, 0, 0);
  }

  // 解析小时
  if (hour !== '*') {
    date.setHours(parseInt(hour), 0, 0, 0);
  } else {
    date.setHours(date.getHours(), 0, 0, 0);
  }

  // 如果设置的时间已经过去，推到下一天
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

  createJob(label: string, schedule: string, task: string): CronJob {
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
        console.log(`[CronManager] Executing job: ${job.label}`);

        // 发送通知
        notificationSystem.add('cron', job.label, job.task);

        // 触发回调
        for (const callback of this.callbacks) {
          callback(job);
        }

        // 计算下次执行时间
        job.nextRun = parseCronExpression(job.schedule, now);
        this.saveJob(job);
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
