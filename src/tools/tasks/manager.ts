/**
 * Task 任务系统模块
 *
 * 实现持久化任务图：
 * 1. 每个任务一个 JSON 文件
 * 2. 支持依赖关系 (blockedBy, blocks)
 * 3. 状态追踪 (pending -> in_progress -> completed)
 * 4. 依赖自动解除
 */

import * as fs from 'fs';
import * as path from 'path';
import { getTasksPath } from '../../utils/path.js';

export interface Task {
  /** 任务 ID */
  id: number;
  /** 任务标题 */
  subject: string;
  /** 任务描述 */
  description: string;
  /** 任务状态 */
  status: 'pending' | 'in_progress' | 'completed';
  /** 任务优先级 (数值越小越高) */
  priority: number;
  /** 阻塞此任务的任务 ID */
  blockedBy: number[];
  /** 被此任务阻塞的任务 ID */
  blocks: number[];
  /** 任务负责人 */
  owner: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

export interface TaskCreateParams {
  subject: string;
  description?: string;
  owner?: string;
  priority?: number;
  blockedBy?: number[];
  blocks?: number[];
}

export interface TaskUpdateParams {
  task_id: number;
  status?: 'pending' | 'in_progress' | 'completed';
  subject?: string;
  description?: string;
  owner?: string;
  priority?: number;
  add_blocked_by?: number[];
  add_blocks?: number[];
  remove_blocked_by?: number[];
  remove_blocks?: number[];
}

/**
 * 任务管理器
 */
export class TaskManager {
  private tasksDir: string;
  private nextId: number = 1;

  constructor(tasksDir?: string) {
    // 默认使用统一路径管理
    this.tasksDir = tasksDir || getTasksPath();
    this.ensureDir();
    this.loadNextId();
  }

  /**
   * 确保任务目录存在
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.tasksDir)) {
      fs.mkdirSync(this.tasksDir, { recursive: true });
    }
  }

  /**
   * 加载下一个 ID
   */
  private loadNextId(): void {
    const files = fs.readdirSync(this.tasksDir).filter(f => f.startsWith('task_') && f.endsWith('.json'));
    if (files.length === 0) {
      this.nextId = 1;
      return;
    }

    let maxId = 0;
    for (const file of files) {
      const match = file.match(/task_(\d+)\.json/);
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > maxId) maxId = id;
      }
    }
    this.nextId = maxId + 1;
  }

  /**
   * 获取任务文件路径
   */
  private getTaskPath(taskId: number): string {
    return path.join(this.tasksDir, `task_${taskId}.json`);
  }

  /**
   * 保存任务
   */
  private saveTask(task: Task): void {
    const filePath = this.getTaskPath(task.id);
    fs.writeFileSync(filePath, JSON.stringify(task, null, 2));
  }

  /**
   * 加载任务
   */
  private loadTask(taskId: number): Task | null {
    const filePath = this.getTaskPath(taskId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Task;
  }

  /**
   * 获取所有任务
   */
  private getAllTasks(): Task[] {
    const files = fs.readdirSync(this.tasksDir).filter(f => f.startsWith('task_') && f.endsWith('.json'));
    const tasks: Task[] = [];

    for (const file of files) {
      const match = file.match(/task_(\d+)\.json/);
      if (match) {
        const id = parseInt(match[1], 10);
        const task = this.loadTask(id);
        if (task) tasks.push(task);
      }
    }

    return tasks.sort((a, b) => a.id - b.id);
  }

  /**
   * 创建任务
   */
  create(params: TaskCreateParams): Task {
    const now = Date.now();
    const blockedBy = params.blockedBy || [];
    const blocks = params.blocks || [];

    const task: Task = {
      id: this.nextId++,
      subject: params.subject,
      description: params.description || '',
      status: 'pending',
      priority: params.priority ?? 100, // 默认优先级 100
      blockedBy,
      blocks,
      owner: params.owner || '',
      createdAt: now,
      updatedAt: now,
    };

    // 保存任务
    this.saveTask(task);

    // 更新被阻塞任务的 blockedBy
    for (const blockedId of blockedBy) {
      const blockedTask = this.loadTask(blockedId);
      if (blockedTask && !blockedTask.blocks.includes(task.id)) {
        blockedTask.blocks.push(task.id);
        blockedTask.updatedAt = now;
        this.saveTask(blockedTask);
      }
    }

    // 更新阻塞任务的 blocks
    for (const blockId of blocks) {
      const blockTask = this.loadTask(blockId);
      if (blockTask && !blockTask.blockedBy.includes(task.id)) {
        blockTask.blockedBy.push(task.id);
        blockTask.updatedAt = now;
        this.saveTask(blockTask);
      }
    }

    return task;
  }

  /**
   * 获取任务
   */
  get(taskId: number): Task | null {
    return this.loadTask(taskId);
  }

  /**
   * 更新任务
   */
  update(params: TaskUpdateParams): Task | null {
    const task = this.loadTask(params.task_id);
    if (!task) {
      return null;
    }

    const now = Date.now();

    // 更新状态
    if (params.status) {
      task.status = params.status;

      // 如果完成，清除依赖
      if (params.status === 'completed') {
        this.clearDependency(task.id);
        // 重新加载任务以获取更新后的 blocks
        const reloadedTask = this.loadTask(task.id);
        if (reloadedTask) {
          task.blockedBy = reloadedTask.blockedBy;
          task.blocks = reloadedTask.blocks;
        }
      }
    }

    // 更新基本信息
    if (params.subject) task.subject = params.subject;
    if (params.description !== undefined) task.description = params.description;
    if (params.owner !== undefined) task.owner = params.owner;
    if (params.priority !== undefined) task.priority = params.priority;

    // 添加 blockedBy
    if (params.add_blocked_by) {
      for (const blockedId of params.add_blocked_by) {
        if (!task.blockedBy.includes(blockedId)) {
          task.blockedBy.push(blockedId);
          // 更新被阻塞任务的 blocks
          const blockedTask = this.loadTask(blockedId);
          if (blockedTask && !blockedTask.blocks.includes(task.id)) {
            blockedTask.blocks.push(task.id);
            blockedTask.updatedAt = now;
            this.saveTask(blockedTask);
          }
        }
      }
    }

    // 添加 blocks
    if (params.add_blocks) {
      for (const blockId of params.add_blocks) {
        if (!task.blocks.includes(blockId)) {
          task.blocks.push(blockId);
          // 更新阻塞任务的 blockedBy
          const blockTask = this.loadTask(blockId);
          if (blockTask && !blockTask.blockedBy.includes(task.id)) {
            blockTask.blockedBy.push(task.id);
            blockTask.updatedAt = now;
            this.saveTask(blockTask);
          }
        }
      }
    }

    // 移除 blockedBy
    if (params.remove_blocked_by) {
      task.blockedBy = task.blockedBy.filter(id => !params.remove_blocked_by!.includes(id));
    }

    // 移除 blocks
    if (params.remove_blocks) {
      task.blocks = task.blocks.filter(id => !params.remove_blocks!.includes(id));
    }

    task.updatedAt = now;
    this.saveTask(task);

    return task;
  }

  /**
   * 清除依赖关系
   */
  private clearDependency(completedId: number): void {
    const allTasks = this.getAllTasks();

    for (const task of allTasks) {
      let updated = false;

      // 从 blockedBy 中移除
      if (task.blockedBy.includes(completedId)) {
        task.blockedBy = task.blockedBy.filter(id => id !== completedId);
        updated = true;
      }

      // 从 blocks 中移除
      if (task.blocks.includes(completedId)) {
        task.blocks = task.blocks.filter(id => id !== completedId);
        updated = true;
      }

      // 如果是已完成的任务，清除自己的 blocks 列表
      if (task.id === completedId && task.blocks.length > 0) {
        task.blocks = [];
        updated = true;
      }

      if (updated) {
        task.updatedAt = Date.now();
        this.saveTask(task);
      }
    }
  }

  /**
   * 列出所有任务
   */
  list(): Task[] {
    return this.getAllTasks();
  }

  /**
   * 列出可执行的任务（pending 且没有被阻塞）
   */
  listRunnable(): Task[] {
    const tasks = this.getAllTasks();
    const runnable = tasks.filter(task => task.status === 'pending' && task.blockedBy.length === 0);
    // 按优先级排序（数值越小优先级越高），undefined 优先级最低，同优先级按创建时间排序
    return runnable.sort((a, b) => {
      const aPriority = a.priority ?? Infinity;
      const bPriority = b.priority ?? Infinity;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * 列出被阻塞的任务
   */
  listBlocked(): Task[] {
    const tasks = this.getAllTasks();
    return tasks.filter(task => task.status === 'pending' && task.blockedBy.length > 0);
  }

  /**
   * 删除任务
   */
  delete(taskId: number): boolean {
    const task = this.loadTask(taskId);
    if (!task) {
      return false;
    }

    // 从其他任务的 blockedBy 和 blocks 中移除
    const allTasks = this.getAllTasks();
    const now = Date.now();

    for (const t of allTasks) {
      let updated = false;

      t.blockedBy = t.blockedBy.filter(id => {
        if (id === taskId) {
          updated = true;
          return false;
        }
        return true;
      });

      t.blocks = t.blocks.filter(id => {
        if (id === taskId) {
          updated = true;
          return false;
        }
        return true;
      });

      if (updated) {
        t.updatedAt = now;
        this.saveTask(t);
      }
    }

    // 删除任务文件
    const filePath = this.getTaskPath(taskId);
    fs.unlinkSync(filePath);

    return true;
  }

  /**
   * 获取任务统计
   */
  getStats(): { total: number; pending: number; inProgress: number; completed: number; blocked: number } {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'pending' && t.blockedBy.length > 0).length,
    };
  }
}

/**
 * 全局任务管理器实例
 */
let globalTaskManager: TaskManager | null = null;

/**
 * 获取任务管理器实例
 */
export function getTaskManager(tasksDir?: string): TaskManager {
  if (!globalTaskManager) {
    globalTaskManager = new TaskManager(tasksDir);
  }
  return globalTaskManager;
}

/**
 * 重置任务管理器（用于测试）
 */
export function resetTaskManager(): void {
  globalTaskManager = null;
}
