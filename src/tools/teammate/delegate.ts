/**
 * teammate_delegate - 任务委派工具
 *
 * 支持向指定队友委派任务：
 * - 可指定任务描述、上下文、截止时间
 * - 任务可跟踪状态
 * - 完成后自动通知委托者
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { jsonResult, errorResult } from "../types.js";

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'teammates', 'delegations');

/**
 * 确保存储目录存在
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * 委派任务记录
 */
interface Delegation {
  id: string;
  from: string;
  to: string;
  task: string;
  context?: string;
  deadline?: string;
  status: 'pending' | 'completed' | 'rejected';
  result?: string;
  createdAt: number;
  completedAt?: number;
}

/**
 * 保存委派记录
 */
function saveDelegation(d: Delegation): void {
  ensureStorageDir();
  const filePath = path.join(STORAGE_DIR, `${d.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(d, null, 2), 'utf-8');
}

/**
 * 加载委派记录
 */
function loadDelegation(id: string): Delegation | null {
  const filePath = path.join(STORAGE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Delegation;
  } catch {
    return null;
  }
}

/**
 * 创建委派任务
 */
export function createTeammateDelegateTool() {
  return {
    label: "Teammate Delegate",
    name: "teammate_delegate",
    description: 'Delegate a task to a specific teammate. The task will be tracked and you will be notified upon completion.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Name of the teammate to delegate task to',
        },
        task: {
          type: 'string',
          description: 'Task description to delegate',
        },
        context: {
          type: 'string',
          description: 'Additional context information for the task',
        },
        deadline: {
          type: 'string',
          description: 'Optional deadline (ISO 8601 format or relative like "1h", "2d")',
        },
      },
      required: ['to', 'task'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const to = params.to as string;
        const task = params.task as string;
        const context = params.context as string | undefined;
        const deadline = params.deadline as string | undefined;

        if (!to || !task) {
          return errorResult('to and task are required');
        }

        // 检查队友是否存在
        const { listTeammates } = await import('../../agents/teammate.js');
        const teammates = listTeammates();
        const teammateExists = teammates.some(t => t.name === to && t.status !== 'SHUTDOWN');

        if (!teammateExists) {
          return errorResult(`Teammate "${to}" not found or is shut down`);
        }

        // 创建委派记录
        const delegation: Delegation = {
          id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          from: 'lead',
          to,
          task,
          context,
          deadline,
          status: 'pending',
          createdAt: Date.now(),
        };

        saveDelegation(delegation);

        // 发送任务消息给队友
        const { sendToTeammate } = await import('../../agents/teammate.js');
        const message = `[Delegation #${delegation.id}]\n\nTask: ${task}${context ? `\n\nContext: ${context}` : ''}${deadline ? `\n\nDeadline: ${deadline}` : ''}\n\nPlease complete this task and report back.`;
        sendToTeammate('lead', to, message, 'delegation');

        return jsonResult({
          delegation_id: delegation.id,
          to,
          task,
          status: 'pending',
          message: `Task delegated to ${to}`,
        });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}

/**
 * 创建委派状态查询工具
 */
export function createTeammateDelegationStatusTool() {
  return {
    label: "Delegate Status",
    name: "teammate_delegation_status",
    description: 'Check the status of a delegated task',
    parameters: {
      type: 'object',
      properties: {
        delegation_id: {
          type: 'string',
          description: 'ID of the delegation to check',
        },
      },
      required: ['delegation_id'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const delegationId = params.delegation_id as string;

        if (!delegationId) {
          return errorResult('delegation_id is required');
        }

        const delegation = loadDelegation(delegationId);

        if (!delegation) {
          return errorResult(`Delegation "${delegationId}" not found`);
        }

        return jsonResult({
          delegation_id: delegation.id,
          from: delegation.from,
          to: delegation.to,
          task: delegation.task,
          status: delegation.status,
          result: delegation.result,
          created_at: new Date(delegation.createdAt).toISOString(),
          completed_at: delegation.completedAt ? new Date(delegation.completedAt).toISOString() : null,
        });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}

/**
 * 完成任务（供队友调用）
 */
export async function completeDelegation(delegationId: string, result: string): Promise<void> {
  const delegation = loadDelegation(delegationId);
  if (delegation && delegation.status === 'pending') {
    delegation.status = 'completed';
    delegation.result = result;
    delegation.completedAt = Date.now();
    saveDelegation(delegation);

    // 通知委托者
    const { sendToTeammate } = await import('../../agents/teammate.js');
    const message = `[Delegation #${delegationId} Completed]\n\nTask: ${delegation.task}\n\nResult: ${result}`;
    sendToTeammate(delegation.to, delegation.from, message, 'delegation_complete');
  }
}
