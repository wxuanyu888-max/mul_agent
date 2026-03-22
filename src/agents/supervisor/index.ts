/**
 * Supervisor 多 Agent 协作系统
 *
 * 提供 Supervisor 模式的实现：
 * - 节点注册表 (NodeRegistry)
 * - Supervisor 管理器 (SupervisorManager)
 */

// 类型导出
export * from './types.js';

// 节点注册表
export { NodeRegistry, getNodeRegistry } from './registry.js';

// Supervisor 管理器
export { SupervisorManager, getSupervisorManager } from './manager.js';

// 便捷函数
import { getSupervisorManager } from './manager.js';

/**
 * 创建 Supervisor
 */
export async function createSupervisor(config: {
  name: string;
  role: string;
  sessionId: string;
  maxConcurrentSubtasks?: number;
}): Promise<string> {
  const manager = getSupervisorManager();
  return manager.createSupervisor(config);
}

/**
 * 分解任务
 */
export async function decomposeTasks(
  supervisorId: string,
  task: string,
  subtasks: Array<{
    name: string;
    description: string;
    type: 'subagent' | 'teammate';
    dependencies?: string[];
  }>
): Promise<string[]> {
  const manager = getSupervisorManager();
  return manager.decompose(supervisorId, task, subtasks);
}

/**
 * 委托任务
 */
export async function delegateTask(
  supervisorId: string,
  taskId: string,
  nodeId?: string
): Promise<void> {
  const manager = getSupervisorManager();
  return manager.delegate(supervisorId, taskId, nodeId);
}

/**
 * 更新任务状态
 */
export async function updateTask(
  supervisorId: string,
  taskId: string,
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
  result?: string,
  error?: string
): Promise<void> {
  const manager = getSupervisorManager();
  return manager.updateTaskStatus(supervisorId, taskId, status, result, error);
}

/**
 * 获取任务状态
 */
export async function getTaskStatus(
  taskId: string,
  supervisorId: string
): Promise<import('./types.js').SubTask | null> {
  const manager = getSupervisorManager();
  return manager.getTaskStatus(taskId, supervisorId);
}

/**
 * 获取所有任务
 */
export async function getAllTasks(
  supervisorId: string
): Promise<import('./types.js').SubTask[]> {
  const manager = getSupervisorManager();
  return manager.getAllTasks(supervisorId);
}

/**
 * 收集结果
 */
export async function collectSupervisorResults(
  supervisorId: string
): Promise<Record<string, string>> {
  const manager = getSupervisorManager();
  return manager.collectResults(supervisorId);
}

/**
 * 终止 Supervisor
 */
export async function terminateSupervisor(supervisorId: string): Promise<void> {
  const manager = getSupervisorManager();
  return manager.terminate(supervisorId);
}

/**
 * 获取 Supervisor 状态
 */
export async function getSupervisorStatus(
  supervisorId: string
): Promise<import('./types.js').SupervisorState | null> {
  const manager = getSupervisorManager();
  return manager.getStatus(supervisorId);
}

// Supervisor 工具
export { createSupervisorTool } from './tool.js';

// Supervisor Loop - 自助循环控制系统
export { SupervisorLoop, createSupervisorLoop, runAutonomousTask } from './loop.js';
export type { SupervisorLoopConfig, SupervisorLoopState } from './loop.js';
