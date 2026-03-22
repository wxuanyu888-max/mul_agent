/**
 * SupervisorManager - Supervisor 管理器
 *
 * 负责 Supervisor 的创建、任务分解、委托和状态管理
 */

import { randomUUID } from 'node:crypto';
import {
  type SupervisorConfig,
  type SupervisorState,
  type SubTask,
  type SubTaskStatus,
  type NodeInfo,
} from './types.js';
import { getNodeRegistry, type NodeRegistry } from './registry.js';

/**
 * 生成唯一 ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().substring(0, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Supervisor 管理器
 */
export class SupervisorManager {
  private registry: NodeRegistry;
  private supervisors: Map<string, SupervisorState> = new Map();

  constructor(registry?: NodeRegistry) {
    this.registry = registry || getNodeRegistry();
  }

  /**
   * 创建 Supervisor（注册为持久化节点）
   */
  async createSupervisor(config: SupervisorConfig): Promise<string> {
    const supervisorId = generateId('supervisor');

    const nodeInfo: NodeInfo = {
      id: supervisorId,
      name: config.name,
      type: 'supervisor',
      status: 'registered',
      sessionId: config.sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        role: config.role,
        maxConcurrentSubtasks: config.maxConcurrentSubtasks ?? 5,
      },
    };

    // 注册节点
    await this.registry.register(nodeInfo);

    // 初始化 Supervisor 状态
    const state: SupervisorState = {
      supervisorId,
      sessionId: config.sessionId,
      status: 'idle',
      subTasks: {},
      results: {},
      currentIteration: 0,
    };

    this.supervisors.set(supervisorId, state);

    // 保存状态
    await this.registry.saveState(state);

    return supervisorId;
  }

  /**
   * 分解任务为子任务
   *
   * @param supervisorId Supervisor ID
   * @param task 任务描述
   * @param subtasks 子任务定义数组
   * @returns 子任务 ID 数组
   */
  async decompose(
    supervisorId: string,
    task: string,
    subtasks: Array<{ name: string; description: string; type: 'subagent' | 'teammate'; dependencies?: string[] }>
  ): Promise<string[]> {
    const state = await this.getStatus(supervisorId);
    if (!state) {
      throw new Error(`Supervisor ${supervisorId} not found`);
    }

    // 更新状态为 decomposing
    state.status = 'decomposing';
    await this.registry.updateStatus(supervisorId, state.sessionId, 'running');

    const taskIds: string[] = [];

    for (const subtask of subtasks) {
      const taskId = generateId('task');

      const subTask: SubTask = {
        id: taskId,
        name: subtask.name,
        description: subtask.description,
        type: subtask.type,
        status: 'pending',
        dependencies: subtask.dependencies || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      state.subTasks[taskId] = subTask;
      taskIds.push(taskId);
    }

    state.status = 'idle';
    state.currentIteration++;

    this.supervisors.set(supervisorId, state);
    await this.registry.saveState(state);

    return taskIds;
  }

  /**
   * 委托子任务
   *
   * @param supervisorId Supervisor ID
   * @param taskId 子任务 ID
   * @param nodeId 执行节点的 ID（可选）
   */
  async delegate(supervisorId: string, taskId: string, nodeId?: string): Promise<void> {
    const state = await this.getStatus(supervisorId);
    if (!state) {
      throw new Error(`Supervisor ${supervisorId} not found`);
    }

    const subTask = state.subTasks[taskId];
    if (!subTask) {
      throw new Error(`SubTask ${taskId} not found`);
    }

    // 更新状态为 delegating
    state.status = 'delegating';

    // 更新子任务状态
    subTask.status = 'running';
    subTask.nodeId = nodeId;
    subTask.updatedAt = Date.now();

    this.supervisors.set(supervisorId, state);
    await this.registry.saveState(state);
  }

  /**
   * 更新子任务状态
   */
  async updateTaskStatus(
    supervisorId: string,
    taskId: string,
    status: SubTaskStatus,
    result?: string,
    error?: string
  ): Promise<void> {
    const state = await this.getStatus(supervisorId);
    if (!state) {
      throw new Error(`Supervisor ${supervisorId} not found`);
    }

    const subTask = state.subTasks[taskId];
    if (!subTask) {
      throw new Error(`SubTask ${taskId} not found`);
    }

    // 更新子任务状态
    subTask.status = status;
    subTask.updatedAt = Date.now();

    if (result !== undefined) {
      subTask.result = result;
      state.results[taskId] = result;
    }

    if (error !== undefined) {
      subTask.error = error;
    }

    this.supervisors.set(supervisorId, state);
    await this.registry.saveState(state);
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string, supervisorId: string): Promise<SubTask | null> {
    const state = await this.getStatus(supervisorId);
    if (!state) {
      return null;
    }
    return state.subTasks[taskId] || null;
  }

  /**
   * 获取所有任务状态
   */
  async getAllTasks(supervisorId: string): Promise<SubTask[]> {
    const state = await this.getStatus(supervisorId);
    if (!state) {
      return [];
    }
    return Object.values(state.subTasks);
  }

  /**
   * 收集结果
   */
  async collectResults(supervisorId: string): Promise<Record<string, string>> {
    const state = await this.getStatus(supervisorId);
    if (!state) {
      throw new Error(`Supervisor ${supervisorId} not found`);
    }

    state.status = 'aggregating';

    // 检查是否所有任务都完成
    const allCompleted = Object.values(state.subTasks).every(
      task => task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
    );

    if (allCompleted) {
      state.status = 'completed';
      await this.registry.updateStatus(supervisorId, state.sessionId, 'completed');
    } else {
      state.status = 'waiting';
    }

    this.supervisors.set(supervisorId, state);
    await this.registry.saveState(state);

    return state.results;
  }

  /**
   * 终止 Supervisor
   */
  async terminate(supervisorId: string): Promise<void> {
    const state = await this.getStatus(supervisorId);
    if (!state) {
      throw new Error(`Supervisor ${supervisorId} not found`);
    }

    // 将所有 pending/running 的任务标记为 cancelled
    for (const task of Object.values(state.subTasks)) {
      if (task.status === 'pending' || task.status === 'running') {
        task.status = 'cancelled';
        task.updatedAt = Date.now();
      }
    }

    state.status = 'idle';
    this.supervisors.set(supervisorId, state);

    await this.registry.updateStatus(supervisorId, state.sessionId, 'terminated');
    await this.registry.saveState(state);
  }

  /**
   * 获取 Supervisor 状态
   */
  async getStatus(supervisorId: string): Promise<SupervisorState | null> {
    // 优先从内存获取
    const cached = this.supervisors.get(supervisorId);
    if (cached) {
      return cached;
    }

    // 从注册表恢复：先找到 supervisor 所在的 session
    const sessions = await this.registry.listAllSessions();

    for (const sessionId of sessions) {
      const node = await this.registry.get(supervisorId, sessionId);
      if (node && node.type === 'supervisor') {
        const state = await this.registry.restoreState(supervisorId, sessionId);
        if (state) {
          this.supervisors.set(supervisorId, state);
          return state;
        }
      }
    }

    return null;
  }

  /**
   * 获取 Supervisor 的节点信息
   */
  async getNodeInfo(supervisorId: string, sessionId: string): Promise<NodeInfo | null> {
    return this.registry.get(supervisorId, sessionId);
  }
}

// 全局单例
let globalManager: SupervisorManager | null = null;

/**
 * 获取 SupervisorManager 单例
 */
export function getSupervisorManager(): SupervisorManager {
  if (!globalManager) {
    globalManager = new SupervisorManager();
  }
  return globalManager;
}
