/**
 * Background Manager - 后台任务管理
 *
 * 实现线程安全的后台任务执行：
 * 1. 守护线程执行命令，立即返回
 * 2. 结果进入通知队列
 * 3. 支持查询任务状态
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as readline from 'node:readline';
import { randomUUID } from 'node:crypto';

export interface BackgroundTask {
  id: string;
  command: string;
  cwd?: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  startedAt: Date;
  completedAt?: Date;
  output: string;
  exitCode?: number;
  error?: string;
}

export interface BackgroundNotification {
  taskId: string;
  status: 'completed' | 'failed' | 'timeout';
  output: string;
  exitCode?: number;
  error?: string;
}

/**
 * 后台任务管理器
 */
export class BackgroundManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private notificationQueue: BackgroundNotification[] = [];
  private processes: Map<string, ChildProcess> = new Map();

  /**
   * 启动后台任务
   */
  run(command: string, cwd?: string, timeoutMs: number = 300000): string {
    const taskId = randomUUID().substring(0, 8);

    const task: BackgroundTask = {
      id: taskId,
      command,
      cwd,
      status: 'running',
      startedAt: new Date(),
      output: '',
    };

    this.tasks.set(taskId, task);

    // 启动守护线程执行命令
    this.executeInBackground(taskId, command, cwd, timeoutMs);

    return taskId;
  }

  /**
   * 在后台线程中执行命令
   */
  private executeInBackground(
    taskId: string,
    command: string,
    cwd?: string,
    timeoutMs: number = 300000
  ): void {
    const child = spawn(command, [], {
      shell: true,
      cwd,
      detached: false,
    });

    this.processes.set(taskId, child);

    let output = '';

    // 收集 stdout
    if (child.stdout) {
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        output += line + '\n';
      });
    }

    // 收集 stderr
    if (child.stderr) {
      const rl = readline.createInterface({ input: child.stderr });
      rl.on('line', (line) => {
        output += line + '\n';
      });
    }

    // 设置超时
    const timeoutHandle = setTimeout(() => {
      if (this.processes.has(taskId)) {
        const proc = this.processes.get(taskId)!;
        proc.kill('SIGTERM');

        const task = this.tasks.get(taskId);
        if (task) {
          task.status = 'timeout';
          task.completedAt = new Date();
          task.output = output.trim();
          task.error = `Timeout after ${timeoutMs}ms`;
        }

        this.enqueueNotification({
          taskId,
          status: 'timeout',
          output: output.trim().substring(0, 50000),
          error: `Timeout after ${timeoutMs}ms`,
        });

        this.processes.delete(taskId);
      }
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      this.processes.delete(taskId);

      const task = this.tasks.get(taskId);
      if (task) {
        task.status = code === 0 ? 'completed' : 'failed';
        task.completedAt = new Date();
        task.output = output.trim();
        task.exitCode = code ?? undefined;
      }

      this.enqueueNotification({
        taskId,
        status: code === 0 ? 'completed' : 'failed',
        output: output.trim().substring(0, 50000),
        exitCode: code ?? undefined,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      this.processes.delete(taskId);

      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.completedAt = new Date();
        task.output = output.trim();
        task.error = err.message;
      }

      this.enqueueNotification({
        taskId,
        status: 'failed',
        output: output.trim().substring(0, 50000),
        error: err.message,
      });
    });
  }

  /**
   * 将通知加入队列（线程安全）
   */
  private enqueueNotification(notification: BackgroundNotification): void {
    this.notificationQueue.push(notification);
  }

  /**
   * 排空通知队列
   */
  drainNotifications(): BackgroundNotification[] {
    const notifications = [...this.notificationQueue];
    this.notificationQueue = [];
    return notifications;
  }

  /**
   * 获取任务状态
   */
  getStatus(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 列出所有任务
   */
  listTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 终止任务
   */
  kill(taskId: string): boolean {
    const proc = this.processes.get(taskId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(taskId);

      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = 'Killed by user';
      }

      return true;
    }
    return false;
  }
}

// 单例实例
let backgroundManagerInstance: BackgroundManager | null = null;

/**
 * 获取 BackgroundManager 单例
 */
export function getBackgroundManager(): BackgroundManager {
  if (!backgroundManagerInstance) {
    backgroundManagerInstance = new BackgroundManager();
  }
  return backgroundManagerInstance;
}
