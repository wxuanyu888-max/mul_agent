/**
 * Autonomous Agent - 自治智能体
 *
 * 实现自组织团队协作：
 * 1. WORK 和 IDLE 两个阶段
 * 2. IDLE 阶段轮询任务看板
 * 3. 自动认领未分配任务
 * 4. 身份重注入（上下文压缩后）
 */

import { createAgentLoop, type AgentLoop } from './loop.js';
import { getTaskManager, type Task } from '../tools/tasks/manager.js';
import { jsonResult, errorResult, type ToolResult } from '../tools/types.js';
import type { Message } from './types.js';

/**
 * 创建消息的辅助函数
 */
function createMessage(role: Message['role'], content: string): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

export interface AutonomousConfig {
  /** 智能体名称 */
  name: string;
  /** 角色 */
  role: string;
  /** 初始任务/提示 */
  prompt?: string;
  /** 团队名称 */
  teamName?: string;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** IDLE 超时时间 (ms) */
  idleTimeoutMs?: number;
  /** 轮询间隔 (ms) */
  pollIntervalMs?: number;
  /** 初始任务 ID */
  initialTaskId?: number;
}

export interface AutonomousResult {
  success: boolean;
  finalStatus: 'completed' | 'shutdown' | 'timeout' | 'error';
  taskClaimed?: number;
  iterations: number;
  error?: string;
}

/**
 * 智能体状态
 */
export type AgentStatus = 'spawning' | 'working' | 'idle' | 'shutdown' | 'error';

/**
 * 团队成员信息
 */
export interface TeamMember {
  name: string;
  role: string;
  teamName: string;
  status: AgentStatus;
  currentTaskId?: number;
  startedAt: Date;
  lastActiveAt: Date;
}

/**
 * 团队管理器
 */
class TeamManager {
  private static instance: TeamManager;
  private members: Map<string, TeamMember> = new Map();

  private constructor() {}

  static getInstance(): TeamManager {
    if (!TeamManager.instance) {
      TeamManager.instance = new TeamManager();
    }
    return TeamManager.instance;
  }

  /**
   * 注册团队成员
   */
  register(member: TeamMember): void {
    this.members.set(member.name, member);
  }

  /**
   * 更新成员状态
   */
  updateStatus(name: string, status: AgentStatus, taskId?: number): void {
    const member = this.members.get(name);
    if (member) {
      member.status = status;
      if (taskId !== undefined) {
        member.currentTaskId = taskId;
      }
      member.lastActiveAt = new Date();
    }
  }

  /**
   * 获取成员列表
   */
  list(): TeamMember[] {
    return Array.from(this.members.values());
  }

  /**
   * 获取成员
   */
  get(name: string): TeamMember | undefined {
    return this.members.get(name);
  }

  /**
   * 移除成员
   */
  remove(name: string): void {
    this.members.delete(name);
  }
}

/**
 * 扫描未认领的任务
 */
function scanUnclaimedTasks(taskManager: ReturnType<typeof getTaskManager>): Task[] {
  const tasks = taskManager.listRunnable();
  return tasks.filter(task => !task.owner);
}

/**
 * 认领任务
 */
function claimTask(taskManager: ReturnType<typeof getTaskManager>, taskId: number, owner: string): Task | null {
  const task = taskManager.update({
    task_id: taskId,
    status: 'in_progress',
    owner,
  });
  return task;
}

/**
 * 创建自治智能体运行器
 */
export function createAutonomousAgent(config: AutonomousConfig): {
  run: () => Promise<AutonomousResult>;
  getStatus: () => AgentStatus;
} {
  const teamName = config.teamName || 'default-team';
  const idleTimeoutMs = config.idleTimeoutMs || 60000; // 60s
  const pollIntervalMs = config.pollIntervalMs || 5000; // 5s

  let status: AgentStatus = 'spawning';
  let iterations = 0;

  const team = TeamManager.getInstance();

  // 注册团队成员
  team.register({
    name: config.name,
    role: config.role,
    teamName,
    status: 'spawning',
    startedAt: new Date(),
    lastActiveAt: new Date(),
  });

  const getStatus = () => status;

  const run = async (): Promise<AutonomousResult> => {
    const taskManager = getTaskManager();

    // 构建初始消息
    let messages: Message[] = [];

    // 如果有初始任务 ID，先认领
    if (config.initialTaskId) {
      claimTask(taskManager, config.initialTaskId, config.name);
      const task = taskManager.get(config.initialTaskId);
      messages.push(createMessage('user', `<task>Task #${config.initialTaskId}: ${task?.subject || 'Unknown'}</task>\n\n${config.prompt || 'Complete this task.'}`));
    } else if (config.prompt) {
      messages.push(createMessage('user', config.prompt));
    } else {
      messages.push(createMessage('user', 'You are now autonomous. Find work from the task board.'));
    }

    team.updateStatus(config.name, 'working', config.initialTaskId);

    // WORK 阶段循环
    while (iterations < (config.maxIterations || 50)) {
      iterations++;

      // 身份重注入：如果消息太少（说明被压缩了），注入身份
      if (messages.length <= 3) {
        messages.unshift(createMessage('user', `<identity>You are '${config.name}', role: ${config.role}, team: ${teamName}. You are an autonomous agent. Continue your work.</identity>`));
        messages.unshift(createMessage('assistant', `I am ${config.name}, role: ${config.role}. Continuing my work.`));
      }

      // 创建临时的 AgentLoop 来处理这一轮
      const loop = createAgentLoop({
        maxIterations: 1, // 只运行一轮
        timeoutMs: 120000,
      });

      // 注册需要的工具
      loop.registerTool(createIdleTool(getStatus, () => {
        status = 'idle';
        team.updateStatus(config.name, 'idle');
      }));

      // 运行一轮
      const result = await loop.run({
        message: messages[messages.length - 1].content,
        history: messages.slice(0, -1),
      });

      // 检查是否需要进入 IDLE
      // 如果没有工具调用，说明空闲了
      if (result.toolCalls === 0 || result.content.includes('idle')) {
        status = 'idle';
        team.updateStatus(config.name, 'idle');

        // 进入 IDLE 阶段
        const idleResult = await idleLoop(taskManager, messages, config.name, idleTimeoutMs, pollIntervalMs);

        if (idleResult === 'shutdown') {
          status = 'shutdown';
          team.updateStatus(config.name, 'shutdown');
          return {
            success: true,
            finalStatus: 'shutdown',
            iterations,
          };
        } else if (idleResult === 'timeout') {
          status = 'shutdown';
          team.updateStatus(config.name, 'shutdown');
          return {
            success: true,
            finalStatus: 'timeout',
            iterations,
          };
        } else if (idleResult === 'work') {
          // 找到任务了，继续 WORK
          status = 'working';
          team.updateStatus(config.name, 'working');
          continue;
        }
      }

      // 添加响应到消息历史
      messages.push(createMessage('assistant', result.content));

      // 检查是否完成
      if (!result.success) {
        status = 'error';
        team.updateStatus(config.name, 'error');
        return {
          success: false,
          finalStatus: 'error',
          iterations,
          error: result.error,
        };
      }
    }

    // 达到最大迭代次数
    status = 'shutdown';
    team.updateStatus(config.name, 'shutdown');
    return {
      success: true,
      finalStatus: 'completed',
      iterations,
    };
  };

  /**
   * IDLE 阶段循环
   */
  async function idleLoop(
    taskManager: ReturnType<typeof getTaskManager>,
    messages: Message[],
    agentName: string,
    idleTimeoutMs: number,
    pollIntervalMs: number
  ): Promise<'shutdown' | 'timeout' | 'work'> {
    const maxPolls = Math.floor(idleTimeoutMs / pollIntervalMs);

    for (let i = 0; i < maxPolls; i++) {
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      // 扫描未认领的任务
      const unclaimed = scanUnclaimedTasks(taskManager);

      if (unclaimed.length > 0) {
        // 认领第一个可用任务
        const task = claimTask(taskManager, unclaimed[0].id, agentName);
        if (task) {
          team.updateStatus(agentName, 'working', task.id);

          // 添加任务信息到消息
          messages.push(createMessage('user', `<auto-claimed>Task #${task.id}: ${task.subject}</auto-claimed>\n\n${task.description || 'Complete this task.'}`));

          return 'work';
        }
      }
    }

    // 超时
    return 'timeout';
  }

  return { run, getStatus };
}

/**
 * 创建 idle 工具
 */
function createIdleTool(
  getStatus: () => AgentStatus,
  setIdle: () => void
) {
  return {
    label: 'Idle',
    name: 'idle',
    description: 'Request to enter idle state. The agent will poll for new tasks from the task board.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_toolCallId: string, _params: Record<string, unknown>) => {
      setIdle();
      return jsonResult({
        status: 'idle',
        message: 'Agent entered idle state. Will poll for new tasks.',
      });
    },
  };
}

/**
 * 创建 claim_task 工具
 */
export function createClaimTaskTool() {
  return {
    label: 'Claim Task',
    name: 'claim_task',
    description: 'Claim an unassigned task from the task board. Only claims pending tasks with no owner.',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'number',
          description: 'Task ID to claim',
        },
      },
      required: ['task_id'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const taskId = params.task_id as number;
      const taskManager = getTaskManager();
      const task = taskManager.get(taskId);

      if (!task) {
        return errorResult(`Task not found: ${taskId}`);
      }

      if (task.status !== 'pending') {
        return errorResult(`Task ${taskId} is not pending (status: ${task.status})`);
      }

      if (task.blockedBy && task.blockedBy.length > 0) {
        return errorResult(`Task ${taskId} is blocked by tasks: ${task.blockedBy.join(', ')}`);
      }

      if (task.owner) {
        return errorResult(`Task ${taskId} is already owned by: ${task.owner}`);
      }

      // 认领任务
      const updated = taskManager.update({
        task_id: taskId,
        status: 'in_progress',
        owner: 'autonomous', // 可以扩展为传入 agent name
      });

      return jsonResult({
        success: true,
        task: {
          id: updated?.id,
          subject: updated?.subject,
          status: updated?.status,
          owner: updated?.owner,
        },
        message: `Task ${taskId} claimed successfully`,
      });
    },
  };
}

/**
 * 团队列表工具
 */
export function createTeamListTool() {
  return {
    label: 'Team List',
    name: 'team_list',
    description: 'List all team members and their current status.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_toolCallId: string, _params: Record<string, unknown>) => {
      const team = TeamManager.getInstance();
      const members = team.list();

      return jsonResult({
        members: members.map(m => ({
          name: m.name,
          role: m.role,
          team: m.teamName,
          status: m.status,
          current_task_id: m.currentTaskId,
          started_at: m.startedAt.toISOString(),
          last_active: m.lastActiveAt.toISOString(),
        })),
        count: members.length,
      });
    },
  };
}

/**
 * 获取团队管理器
 */
export function getTeamManager(): TeamManager {
  return TeamManager.getInstance();
}
