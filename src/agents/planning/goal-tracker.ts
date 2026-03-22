/**
 * 目标追踪器
 *
 * 维护目标状态机，跟踪子任务完成情况
 */

import type {
  Goal,
  Subtask,
  SubtaskStatus,
  GoalStatus,
  IGoalTracker,
} from './types.js';

/**
 * 目标追踪器实现
 */
export class GoalTracker implements IGoalTracker {
  private currentGoal?: Goal;
  private completedSubtasks: Set<string> = new Set();

  /**
   * 初始化目标
   */
  initializeGoal(goal: Goal): void {
    this.currentGoal = goal;
    this.completedSubtasks.clear();

    // 标记已完成的子任务
    for (const subtask of goal.subtasks) {
      if (subtask.status === 'completed') {
        this.completedSubtasks.add(subtask.id);
      }
    }

    console.log(`[GoalTracker] Initialized goal with ${goal.subtasks.length} subtasks`);
  }

  /**
   * 获取当前目标
   */
  getCurrentGoal(): Goal | undefined {
    return this.currentGoal;
  }

  /**
   * 获取下一个可执行的子任务
   * 依赖已完成的子任务，且状态为 pending
   */
  getNextExecutableSubtasks(): Subtask[] {
    if (!this.currentGoal) {
      return [];
    }

    const executable: Subtask[] = [];
    const completed = this.getCompletedSubtaskIds();

    for (const subtask of this.currentGoal.subtasks) {
      if (subtask.status !== 'pending') {
        continue;
      }

      // 检查依赖是否都已完成
      const depsMet = subtask.dependencies.every((depId) => completed.has(depId));

      if (depsMet) {
        executable.push(subtask);
      }
    }

    return executable;
  }

  /**
   * 获取当前正在执行的子任务
   */
  getCurrentSubtask(): Subtask | undefined {
    if (!this.currentGoal) {
      return undefined;
    }

    return this.currentGoal.subtasks.find((st) => st.status === 'in_progress');
  }

  /**
   * 更新子任务状态
   */
  updateSubtaskStatus(
    subtaskId: string,
    status: SubtaskStatus,
    result?: string,
    error?: string
  ): void {
    if (!this.currentGoal) {
      console.warn('[GoalTracker] No current goal to update');
      return;
    }

    const subtask = this.currentGoal.subtasks.find((st) => st.id === subtaskId);

    if (!subtask) {
      console.warn(`[GoalTracker] Subtask ${subtaskId} not found`);
      return;
    }

    subtask.status = status;
    subtask.updatedAt = Date.now();

    if (status === 'in_progress' && this.currentGoal.status !== 'in_progress') {
      this.currentGoal.status = 'in_progress';
    }

    if (result) {
      subtask.result = result;
    }

    if (error) {
      subtask.error = error;
      subtask.attempts += 1;
    }

    if (status === 'completed') {
      this.completedSubtasks.add(subtaskId);
    } else if (status === 'failed') {
      // 失败时从已完成集合中移除（如果之前有）
      this.completedSubtasks.delete(subtaskId);
    }

    this.currentGoal.updatedAt = Date.now();

    // 检查整体目标状态
    this.checkGoalStatus();

    console.log(
      `[GoalTracker] Subtask ${subtaskId} status: ${status} (${this.getProgressPercentage()}% complete)`
    );
  }

  /**
   * 检查并更新目标状态
   */
  private checkGoalStatus(): void {
    if (!this.currentGoal) return;

    const subtasks = this.currentGoal.subtasks;

    // 所有子任务都完成了，目标完成
    if (subtasks.every((st) => st.status === 'completed')) {
      this.currentGoal.status = 'completed';
      console.log('[GoalTracker] Goal completed!');
      return;
    }

    // 有子任务失败
    const hasFailed = subtasks.some((st) => st.status === 'failed');
    const allDone = subtasks.every(
      (st) => st.status === 'completed' || st.status === 'failed'
    );

    if (hasFailed && allDone) {
      this.currentGoal.status = 'failed';
      console.log('[GoalTracker] Goal failed - all subtasks done but some failed');
    }
  }

  /**
   * 检查目标是否完成
   */
  isGoalComplete(): boolean {
    if (!this.currentGoal) return false;
    return this.currentGoal.status === 'completed';
  }

  /**
   * 检查目标是否失败
   */
  isGoalFailed(): boolean {
    if (!this.currentGoal) return false;
    return this.currentGoal.status === 'failed';
  }

  /**
   * 获取所有失败的子任务
   */
  getFailedSubtasks(): Subtask[] {
    if (!this.currentGoal) return [];
    return this.currentGoal.subtasks.filter((st) => st.status === 'failed');
  }

  /**
   * 获取进度百分比
   */
  getProgressPercentage(): number {
    if (!this.currentGoal || this.currentGoal.subtasks.length === 0) {
      return 0;
    }

    const completed = this.currentGoal.subtasks.filter(
      (st) => st.status === 'completed'
    ).length;

    return Math.round((completed / this.currentGoal.subtasks.length) * 100);
  }

  /**
   * 获取已完成的子任务 ID 集合
   */
  private getCompletedSubtaskIds(): Set<string> {
    if (!this.currentGoal) return new Set();

    const completed = new Set<string>();
    for (const subtask of this.currentGoal.subtasks) {
      if (subtask.status === 'completed') {
        completed.add(subtask.id);
      }
    }
    return completed;
  }

  /**
   * 获取待处理的子任务数量
   */
  getPendingSubtasksCount(): number {
    if (!this.currentGoal) return 0;
    return this.currentGoal.subtasks.filter((st) => st.status === 'pending').length;
  }

  /**
   * 获取摘要信息
   */
  getSummary(): {
    goalId: string;
    status: GoalStatus;
    total: number;
    completed: number;
    inProgress: number;
    failed: number;
    progress: number;
  } {
    if (!this.currentGoal) {
      return {
        goalId: '',
        status: 'pending',
        total: 0,
        completed: 0,
        inProgress: 0,
        failed: 0,
        progress: 0,
      };
    }

    const subtasks = this.currentGoal.subtasks;
    return {
      goalId: this.currentGoal.id,
      status: this.currentGoal.status,
      total: subtasks.length,
      completed: subtasks.filter((st) => st.status === 'completed').length,
      inProgress: subtasks.filter((st) => st.status === 'in_progress').length,
      failed: subtasks.filter((st) => st.status === 'failed').length,
      progress: this.getProgressPercentage(),
    };
  }

  /**
   * 重置目标
   */
  reset(): void {
    this.currentGoal = undefined;
    this.completedSubtasks.clear();
    console.log('[GoalTracker] Reset');
  }

  /**
   * 获取当前目标描述（用于注入 prompt）
   */
  getGoalContext(): string {
    if (!this.currentGoal) {
      return '';
    }

    const summary = this.getSummary();
    const currentSubtask = this.getCurrentSubtask();
    const nextSubtasks = this.getNextExecutableSubtasks();

    let context = `## Current Goal Progress\n`;
    context += `Overall: ${summary.progress}% complete (${summary.completed}/${summary.total} tasks)\n\n`;

    if (currentSubtask) {
      context += `**Currently executing:** ${currentSubtask.description}\n\n`;
    }

    if (nextSubtasks.length > 0) {
      context += `**Up next:**\n`;
      for (const st of nextSubtasks.slice(0, 3)) {
        context += `- ${st.description}\n`;
      }
    }

    return context;
  }
}

/**
 * 创建目标追踪器
 */
export function createGoalTracker(): IGoalTracker {
  return new GoalTracker();
}
