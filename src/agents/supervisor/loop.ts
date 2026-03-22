/**
 * Supervisor Loop - 自助循环控制系统
 *
 * 实现自主循环干活：
 * 1. 接收高层任务目标
 * 2. 使用 LLM 自动分解任务
 * 3. 自动委托给 subagent/teammate
 * 4. 循环监控子任务状态
 * 5. 收集结果并汇总
 */

import { randomUUID } from 'node:crypto';
import type { Message } from '../types.js';
import { getLLMClient } from '../llm.js';
import type {
  SupervisorConfig,
  SupervisorState,
  SubTask,
} from './types.js';
import { getSupervisorManager, createSupervisor, decomposeTasks, delegateTask, updateTask, collectSupervisorResults, getSupervisorStatus, getAllTasks, terminateSupervisor } from './index.js';

/**
 * Supervisor Loop 配置
 */
export interface SupervisorLoopConfig {
  /** Supervisor 基础配置 */
  supervisor: SupervisorConfig;
  /** 最大循环次数 */
  maxIterations?: number;
  /** 轮询间隔 (ms) */
  pollIntervalMs?: number;
  /** 任务完成超时 (ms) */
  taskTimeoutMs?: number;
  /** 是否自动委托给 subagent */
  autoDelegateToSubagent?: boolean;
  /** 是否自动委托给 teammate */
  autoDelegateToTeammate?: boolean;
  /** 最大并发子任务 */
  maxConcurrent?: number;
}

/**
 * Supervisor Loop 状态
 */
export interface SupervisorLoopState {
  supervisorId: string;
  status: 'initializing' | 'decomposing' | 'delegating' | 'running' | 'waiting' | 'aggregating' | 'completed' | 'failed' | 'terminated';
  currentTask: string;
  iterations: number;
  completedTasks: number;
  failedTasks: number;
  startTime: number;
  endTime?: number;
  results: Record<string, string>;
  error?: string;
}

/**
 * 任务分解提示词
 */
const DECOMPOSE_PROMPT = `You are a task decomposition assistant. Given a high-level task, break it down into smaller, executable subtasks.

Task: {{task}}

Requirements:
1. Each subtask should be independent and executable
2. Specify the type: "subagent" for one-off tasks, "teammate" for persistent workers
3. Consider dependencies - if subtask B depends on subtask A, specify A's ID in dependencies

Respond in JSON format:
{
  "subtasks": [
    {
      "name": "subtask-name",
      "description": "What this subtask does",
      "type": "subagent" | "teammate",
      "dependencies": ["other-task-id"] // optional
    }
  ]
}`;

/**
 * 结果汇总提示词
 */
const AGGREGATE_PROMPT = `You are a result aggregation assistant. Given multiple subtask results, summarize them into a coherent output.

Subtask Results:
{{results}}

Original Task: {{task}}

Provide a summary of:
1. What was accomplished
2. Key findings/results
3. Any issues or blockers
4. Recommendations for next steps

Respond in JSON format:
{
  "summary": "Overall summary text",
  "highlights": ["point 1", "point 2"],
  "issues": ["issue 1"], // optional
  "nextSteps": ["step 1"] // optional
}`;

/**
 * Supervisor Loop - 自助循环控制器
 */
export class SupervisorLoop {
  private config: Required<SupervisorLoopConfig>;
  private state: SupervisorLoopState;
  private running: boolean = false;

  constructor(config: SupervisorLoopConfig) {
    this.config = {
      supervisor: config.supervisor,
      maxIterations: config.maxIterations ?? 20,
      pollIntervalMs: config.pollIntervalMs ?? 5000,
      taskTimeoutMs: config.taskTimeoutMs ?? 300000,
      autoDelegateToSubagent: config.autoDelegateToSubagent ?? true,
      autoDelegateToTeammate: config.autoDelegateToTeammate ?? false,
      maxConcurrent: config.maxConcurrent ?? 3,
    };

    this.state = {
      supervisorId: '',
      status: 'initializing',
      currentTask: '',
      iterations: 0,
      completedTasks: 0,
      failedTasks: 0,
      startTime: Date.now(),
      results: {},
    };
  }

  /**
   * 启动循环
   */
  async start(task: string): Promise<SupervisorLoopState> {
    this.running = true;
    this.state.currentTask = task;
    this.state.startTime = Date.now();

    try {
      // 1. 创建 Supervisor
      this.state.status = 'initializing';
      const supervisorId = await createSupervisor(this.config.supervisor);
      this.state.supervisorId = supervisorId;
      console.log(`[SupervisorLoop] Created supervisor: ${supervisorId}`);

      // 2. 主循环
      await this.runLoop(task);

      this.state.status = 'completed';
      return this.state;
    } catch (error) {
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      console.error(`[SupervisorLoop] Failed:`, error);
      return this.state;
    } finally {
      this.running = false;
      this.state.endTime = Date.now();
    }
  }

  /**
   * 主循环
   */
  private async runLoop(task: string): Promise<void> {
    while (this.running && this.state.iterations < this.config.maxIterations) {
      this.state.iterations++;
      console.log(`[SupervisorLoop] Iteration ${this.state.iterations}/${this.config.maxIterations}`);

      const status = await getSupervisorStatus(this.state.supervisorId);
      if (!status) {
        throw new Error('Supervisor not found');
      }

      switch (status.status) {
        case 'idle':
          // 3. 分解任务
          await this.decomposeTask(task);
          break;

        case 'decomposing':
          // 等待分解完成
          await this.sleep(1000);
          break;

        case 'delegating':
        case 'waiting':
          // 4. 委托并监控
          await this.delegateAndMonitor();
          break;

        case 'aggregating':
          // 5. 收集结果
          await this.aggregateResults(task);
          break;

        case 'completed':
          // 完成
          this.running = false;
          break;
      }

      // 检查是否所有任务都完成
      const allTasks = await getAllTasks(this.state.supervisorId);
      const pending = allTasks.filter(t => t.status === 'pending' || t.status === 'running');
      const completed = allTasks.filter(t => t.status === 'completed');
      const failed = allTasks.filter(t => t.status === 'failed');

      this.state.completedTasks = completed.length;
      this.state.failedTasks = failed.length;

      if (pending.length === 0 && allTasks.length > 0) {
        // 所有任务完成，收集结果
        await this.aggregateResults(task);
        this.running = false;
      }

      await this.sleep(this.config.pollIntervalMs);
    }
  }

  /**
   * 分解任务
   */
  private async decomposeTask(task: string): Promise<void> {
    this.state.status = 'decomposing';

    try {
      // 使用 LLM 分解任务
      const subtasks = await this.llmDecompose(task);

      if (subtasks.length === 0) {
        console.log(`[SupervisorLoop] No subtasks generated, completing directly`);
        await terminateSupervisor(this.state.supervisorId);
        return;
      }

      // 调用 Supervisor 分解
      const taskIds = await decomposeTasks(this.state.supervisorId, task, subtasks);
      console.log(`[SupervisorLoop] Decomposed into ${taskIds.length} subtasks`);

      // 自动委托所有任务
      for (const taskId of taskIds) {
        await delegateTask(this.state.supervisorId, taskId);
        console.log(`[SupervisorLoop] Delegated task: ${taskId}`);
      }

      this.state.status = 'running';
    } catch (error) {
      console.error(`[SupervisorLoop] Decompose failed:`, error);
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      this.running = false;
    }
  }

  /**
   * 使用 LLM 分解任务
   */
  private async llmDecompose(task: string): Promise<Array<{ name: string; description: string; type: 'subagent' | 'teammate'; dependencies?: string[] }>> {
    try {
      const llm = getLLMClient();

      const prompt = DECOMPOSE_PROMPT.replace('{{task}}', task);

      const response = await llm.chat({
        model: (llm as any).model || 'default',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      });

      // 提取 JSON
      const content = response.content;
      const text = Array.isArray(content)
        ? content.find((c: any) => c.type === 'text')?.text || ''
        : content as string;

      // 解析 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.subtasks || [];
    } catch (error) {
      console.error(`[SupervisorLoop] LLM decompose failed:`, error);
      // 回退到简单分解
      return [
        { name: 'main-task', description: task, type: 'subagent' }
      ];
    }
  }

  /**
   * 委托并监控任务
   */
  private async delegateAndMonitor(): Promise<void> {
    this.state.status = 'delegating';

    const allTasks = await getAllTasks(this.state.supervisorId);
    const pendingTasks = allTasks.filter(t => t.status === 'pending');
    const runningTasks = allTasks.filter(t => t.status === 'running');

    // 检查超时任务
    for (const task of runningTasks) {
      if (task.updatedAt && Date.now() - task.updatedAt > this.config.taskTimeoutMs) {
        console.log(`[SupervisorLoop] Task ${task.id} timed out`);
        await updateTask(this.state.supervisorId, task.id, 'failed', undefined, 'Timeout');
        this.state.failedTasks++;
      }
    }

    // 模拟执行完成（实际应该由 subagent/teammate 更新状态）
    // 这里简化处理：随机标记一些任务完成
    for (const task of runningTasks) {
      // 实际系统中，subagent 会回调更新状态
      // 这里只是演示，实际不会执行
    }

    this.state.status = 'waiting';
  }

  /**
   * 汇总结果
   */
  private async aggregateResults(task: string): Promise<void> {
    this.state.status = 'aggregating';

    try {
      const results = await collectSupervisorResults(this.state.supervisorId);
      this.state.results = results;

      // 使用 LLM 汇总结果
      const summary = await this.llmAggregate(task, results);
      console.log(`[SupervisorLoop] Aggregated ${Object.keys(results).length} results`);
      console.log(`[SupervisorLoop] Summary:`, summary);

      this.state.status = 'completed';
      this.running = false;
    } catch (error) {
      console.error(`[SupervisorLoop] Aggregate failed:`, error);
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      this.running = false;
    }
  }

  /**
   * 使用 LLM 汇总结果
   */
  private async llmAggregate(task: string, results: Record<string, string>): Promise<string> {
    try {
      const llm = getLLMClient();

      const resultsText = Object.entries(results)
        .map(([id, result]) => `Task ${id}: ${result}`)
        .join('\n\n');

      const prompt = AGGREGATE_PROMPT
        .replace('{{results}}', resultsText)
        .replace('{{task}}', task);

      const response = await llm.chat({
        model: (llm as any).model || 'default',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      });

      const content = response.content;
      const text = Array.isArray(content)
        ? content.find((c: any) => c.type === 'text')?.text || ''
        : content as string;

      // 解析 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.summary || text;
      }

      return text;
    } catch (error) {
      console.error(`[SupervisorLoop] LLM aggregate failed:`, error);
      return Object.values(results).join('\n\n');
    }
  }

  /**
   * 停止循环
   */
  async stop(): Promise<void> {
    if (this.state.supervisorId) {
      await terminateSupervisor(this.state.supervisorId);
    }
    this.running = false;
    this.state.status = 'terminated';
    this.state.endTime = Date.now();
  }

  /**
   * 获取状态
   */
  getState(): SupervisorLoopState {
    return { ...this.state };
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建 Supervisor Loop
 */
export function createSupervisorLoop(config: SupervisorLoopConfig): SupervisorLoop {
  return new SupervisorLoop(config);
}

/**
 * 便捷函数：运行一个自主分解和执行的任务
 */
export async function runAutonomousTask(
  task: string,
  options?: {
    name?: string;
    role?: string;
    sessionId?: string;
    maxIterations?: number;
  }
): Promise<SupervisorLoopState> {
  const loop = createSupervisorLoop({
    supervisor: {
      name: options?.name || 'autonomous-supervisor',
      role: options?.role || 'orchestrator',
      sessionId: options?.sessionId || `autonomous_${Date.now()}`,
    },
    maxIterations: options?.maxIterations || 20,
  });

  return loop.start(task);
}
