/**
 * Worktree 工作树模块
 *
 * 实现任务隔离：
 * 1. 每个任务一个独立的 git worktree 目录
 * 2. 任务与 worktree 双向绑定
 * 3. 状态追踪 (absent -> active -> removed | kept)
 * 4. 事件日志 (events.jsonl)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Task, TaskManager } from '../tasks/manager.js';

/**
 * Worktree 条目
 */
export interface Worktree {
  /** Worktree 名称 */
  name: string;
  /** Worktree 目录路径 */
  path: string;
  /** Git 分支名 */
  branch: string;
  /** 绑定的任务 ID */
  taskId?: number;
  /** 状态: absent(不存在) | active(活跃) | removed(已删除) | kept(保留) */
  status: 'absent' | 'active' | 'removed' | 'kept';
  /** 创建时间 */
  createdAt?: number;
  /** 更新时间 */
  updatedAt?: number;
}

/**
 * Worktree 索引
 */
interface WorktreeIndex {
  worktrees: Record<string, Worktree>;
  version: number;
}

/**
 * Worktree 事件
 */
export interface WorktreeEvent {
  event: 'worktree.create.before' | 'worktree.create.after' | 'worktree.create.failed' |
         'worktree.remove.before' | 'worktree.remove.after' | 'worktree.remove.failed' |
         'worktree.keep' | 'task.completed' | 'task.bind' | 'task.unbind';
  task?: { id: number; status: string };
  worktree?: { name: string; status: string };
  error?: string;
  ts: number;
}

/**
 * Worktree 管理器
 */
export class WorktreeManager {
  private worktreesDir: string;
  private indexPath: string;
  private eventsPath: string;
  private taskManager: TaskManager;
  private index: WorktreeIndex;

  constructor(worktreesDir?: string, taskManager?: TaskManager) {
    // 默认使用 .worktrees 目录
    this.worktreesDir = worktreesDir || path.join(process.cwd(), '.worktrees');
    this.indexPath = path.join(this.worktreesDir, 'index.json');
    this.eventsPath = path.join(this.worktreesDir, 'events.jsonl');
    this.taskManager = taskManager || new TaskManager();

    this.ensureDir();
    this.index = this.loadIndex();
  }

  /**
   * 确保目录存在
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.worktreesDir)) {
      fs.mkdirSync(this.worktreesDir, { recursive: true });
    }
  }

  /**
   * 加载索引
   */
  private loadIndex(): WorktreeIndex {
    if (!fs.existsSync(this.indexPath)) {
      return { worktrees: {}, version: 1 };
    }
    const content = fs.readFileSync(this.indexPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 保存索引
   */
  private saveIndex(): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  /**
   * 写入事件
   */
  private emitEvent(event: WorktreeEvent): void {
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(this.eventsPath, line);
  }

  /**
   * 创建 worktree
   * @param name Worktree 名称
   * @param taskId 可选：绑定的任务 ID
   * @param branch 可选：分支名，默认 wt/{name}
   */
  create(name: string, taskId?: number, branch?: string): Worktree | null {
    const fullBranch = branch || `wt/${name}`;
    const worktreePath = path.join(this.worktreesDir, name);

    // 发出创建前事件
    this.emitEvent({
      event: 'worktree.create.before',
      task: taskId ? { id: taskId, status: 'pending' } : undefined,
      worktree: { name, status: 'absent' },
      ts: Date.now(),
    });

    try {
      // 检查目标目录是否已存在
      if (fs.existsSync(worktreePath)) {
        // 如果已存在，检查是否在索引中
        if (this.index.worktrees[name]) {
          this.index.worktrees[name].status = 'active';
          this.index.worktrees[name].updatedAt = Date.now();
          this.saveIndex();
          return this.index.worktrees[name];
        }
        throw new Error(`Directory already exists: ${worktreePath}`);
      }

      // 创建 git worktree
      try {
        execSync(`git worktree add -b ${fullBranch} ${worktreePath} HEAD`, {
          stdio: 'pipe',
          cwd: process.cwd(),
        });
      } catch (gitError: any) {
        // 如果 worktree 命令失败，可能目录已存在
        if (!fs.existsSync(worktreePath)) {
          throw new Error(`Failed to create git worktree: ${gitError.message}`);
        }
      }

      const now = Date.now();
      const worktree: Worktree = {
        name,
        path: worktreePath,
        branch: fullBranch,
        taskId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      // 保存到索引
      this.index.worktrees[name] = worktree;
      this.saveIndex();

      // 如果传入了 taskId，绑定任务
      if (taskId !== undefined) {
        this.bindTask(taskId, name);
      }

      // 发出创建后事件
      this.emitEvent({
        event: 'worktree.create.after',
        task: taskId ? { id: taskId, status: 'in_progress' } : undefined,
        worktree: { name, status: 'active' },
        ts: Date.now(),
      });

      return worktree;
    } catch (error: any) {
      // 发出失败事件
      this.emitEvent({
        event: 'worktree.create.failed',
        task: taskId ? { id: taskId, status: 'pending' } : undefined,
        worktree: { name, status: 'absent' },
        error: error.message,
        ts: Date.now(),
      });
      return null;
    }
  }

  /**
   * 绑定任务到 worktree
   */
  bindTask(taskId: number, worktreeName: string): boolean {
    const worktree = this.index.worktrees[worktreeName];
    if (!worktree) {
      return false;
    }

    const task = this.taskManager.get(taskId);
    if (!task) {
      return false;
    }

    // 更新 worktree
    worktree.taskId = taskId;
    worktree.updatedAt = Date.now();

    // 更新任务状态并绑定 worktree
    if (task.status === 'pending') {
      this.taskManager.update({ task_id: taskId, status: 'in_progress' });
    }

    // 在任务中记录 worktree 名称（需要扩展 Task 类型，这里用 description 或其他字段）
    // 由于 Task 类型没有 worktree 字段，我们只更新 worktree 索引

    this.saveIndex();

    // 发出绑定事件
    this.emitEvent({
      event: 'task.bind',
      task: { id: taskId, status: 'in_progress' },
      worktree: { name: worktreeName, status: 'active' },
      ts: Date.now(),
    });

    return true;
  }

  /**
   * 解除任务绑定
   */
  unbindTask(taskId: number): boolean {
    for (const name in this.index.worktrees) {
      const worktree = this.index.worktrees[name];
      if (worktree.taskId === taskId) {
        worktree.taskId = undefined;
        worktree.updatedAt = Date.now();
        this.saveIndex();

        // 发出解除绑定事件
        this.emitEvent({
          event: 'task.unbind',
          task: { id: taskId, status: 'completed' },
          worktree: { name, status: worktree.status },
          ts: Date.now(),
        });
        return true;
      }
    }
    return false;
  }

  /**
   * 获取 worktree
   */
  get(name: string): Worktree | null {
    return this.index.worktrees[name] || null;
  }

  /**
   * 获取所有 worktrees
   */
  list(): Worktree[] {
    return Object.values(this.index.worktrees);
  }

  /**
   * 获取活跃的 worktrees
   */
  listActive(): Worktree[] {
    return Object.values(this.index.worktrees).filter(w => w.status === 'active');
  }

  /**
   * 在 worktree 中执行命令
   */
  exec(name: string, command: string): { stdout: string; stderr: string; exitCode: number } | null {
    const worktree = this.index.worktrees[name];
    if (!worktree || worktree.status !== 'active') {
      return null;
    }

    try {
      const result = execSync(command, {
        cwd: worktree.path,
        encoding: 'utf-8',
        timeout: 300000, // 5分钟超时
      });
      return { stdout: result, stderr: '', exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1,
      };
    }
  }

  /**
   * 保留 worktree
   */
  keep(name: string): boolean {
    const worktree = this.index.worktrees[name];
    if (!worktree || worktree.status !== 'active') {
      return false;
    }

    worktree.status = 'kept';
    worktree.updatedAt = Date.now();
    this.saveIndex();

    // 发出保留事件
    this.emitEvent({
      event: 'worktree.keep',
      task: worktree.taskId ? { id: worktree.taskId, status: 'in_progress' } : undefined,
      worktree: { name, status: 'kept' },
      ts: Date.now(),
    });

    return true;
  }

  /**
   * 删除 worktree
   */
  remove(name: string, force: boolean = false, completeTask: boolean = false): boolean {
    const worktree = this.index.worktrees[name];
    if (!worktree) {
      return false;
    }

    // 发出删除前事件
    this.emitEvent({
      event: 'worktree.remove.before',
      task: worktree.taskId ? { id: worktree.taskId, status: 'in_progress' } : undefined,
      worktree: { name, status: worktree.status },
      ts: Date.now(),
    });

    try {
      // 尝试移除 git worktree
      try {
        execSync(`git worktree remove ${force ? '--force' : ''} ${worktree.path}`, {
          stdio: 'pipe',
          cwd: process.cwd(),
        });
      } catch (gitError: any) {
        // 如果 git 命令失败，尝试直接删除目录
        if (fs.existsSync(worktree.path)) {
          fs.rmSync(worktree.path, { recursive: true, force });
        }
      }

      // 如果有绑定的任务，完成它
      if (completeTask && worktree.taskId !== undefined) {
        this.taskManager.update({ task_id: worktree.taskId, status: 'completed' });
        this.unbindTask(worktree.taskId);

        // 发出任务完成事件
        this.emitEvent({
          event: 'task.completed',
          task: { id: worktree.taskId, status: 'completed' },
          worktree: { name, status: 'removed' },
          ts: Date.now(),
        });
      }

      // 更新状态
      worktree.status = 'removed';
      worktree.updatedAt = Date.now();
      this.saveIndex();

      // 发出删除后事件
      this.emitEvent({
        event: 'worktree.remove.after',
        task: !completeTask && worktree.taskId ? { id: worktree.taskId, status: 'in_progress' } : undefined,
        worktree: { name, status: 'removed' },
        ts: Date.now(),
      });

      return true;
    } catch (error: any) {
      // 发出失败事件
      this.emitEvent({
        event: 'worktree.remove.failed',
        task: worktree.taskId ? { id: worktree.taskId, status: 'in_progress' } : undefined,
        worktree: { name, status: worktree.status },
        error: error.message,
        ts: Date.now(),
      });
      return false;
    }
  }

  /**
   * 读取事件日志
   */
  getEvents(limit?: number): WorktreeEvent[] {
    if (!fs.existsSync(this.eventsPath)) {
      return [];
    }
    const content = fs.readFileSync(this.eventsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);
    const events = lines.map(l => JSON.parse(l) as WorktreeEvent);
    return limit ? events.slice(-limit) : events;
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; active: number; kept: number; removed: number } {
    const worktrees = this.list();
    return {
      total: worktrees.length,
      active: worktrees.filter(w => w.status === 'active').length,
      kept: worktrees.filter(w => w.status === 'kept').length,
      removed: worktrees.filter(w => w.status === 'removed').length,
    };
  }
}

/**
 * 全局 Worktree 管理器实例
 */
let globalWorktreeManager: WorktreeManager | null = null;

/**
 * 获取 Worktree 管理器实例
 */
export function getWorktreeManager(worktreesDir?: string, taskManager?: TaskManager): WorktreeManager {
  if (!globalWorktreeManager) {
    globalWorktreeManager = new WorktreeManager(worktreesDir, taskManager);
  }
  return globalWorktreeManager;
}

/**
 * 重置 Worktree 管理器（用于测试）
 */
export function resetWorktreeManager(): void {
  globalWorktreeManager = null;
}
