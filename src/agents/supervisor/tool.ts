/**
 * Supervisor tools - Supervisor 工具集
 *
 * 提供以下工具：
 * - supervisor_create: 创建 Supervisor
 * - supervisor_decompose: 分解任务为子任务
 * - supervisor_delegate: 委托子任务给 subagent 或 teammate
 * - supervisor_status: 查询 Supervisor 状态
 * - supervisor_collect: 收集子任务结果
 */

import { errorResult } from "../../tools/types.js";

/**
 * 创建 supervisor 工具（需要 sessionId）
 */
export function createSupervisorTool(sessionId?: string) {
  return {
    label: "Supervisor",
    name: "supervisor",
    description: 'Create a supervisor to orchestrate multi-agent collaboration. The supervisor can decompose tasks, delegate to subagents or teammates, and collect results.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'decompose', 'delegate', 'status', 'collect', 'terminate'],
          description: 'Action to perform',
        },
        supervisor_id: {
          type: 'string',
          description: 'Supervisor ID (required for all actions except create)',
        },
        name: {
          type: 'string',
          description: 'Supervisor name (for create action)',
        },
        role: {
          type: 'string',
          description: 'Supervisor role (for create action)',
        },
        task: {
          type: 'string',
          description: 'Task description (for decompose action)',
        },
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string', enum: ['subagent', 'teammate'] },
              dependencies: { type: 'array', items: { type: 'string' } },
            },
          },
          description: 'Subtasks to create (for decompose action)',
        },
        task_id: {
          type: 'string',
          description: 'Task ID to delegate (for delegate action)',
        },
        node_id: {
          type: 'string',
          description: 'Node ID to delegate to (optional, for delegate action)',
        },
      },
      required: ['action'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const action = params.action as string;

        // 动态导入以避免循环依赖
        const {
          createSupervisor,
          decomposeTasks,
          delegateTask,
          getSupervisorStatus,
          collectSupervisorResults,
          terminateSupervisor,
          getAllTasks,
        } = await import('./index.js');

        switch (action) {
          case 'create': {
            const name = params.name as string;
            const role = (params.role as string) || 'orchestrator';

            if (!name) {
              return errorResult('name is required for create action');
            }

            const effectiveSessionId = sessionId || (params.session_id as string);
            if (!effectiveSessionId) {
              return errorResult('session_id is required for create action');
            }

            const supervisorId = await createSupervisor({
              name,
              role,
              sessionId: effectiveSessionId,
            });

            return {
              content: JSON.stringify({
                supervisor_id: supervisorId,
                name,
                role,
                message: `Supervisor "${name}" created successfully`,
              }, null, 2),
            };
          }

          case 'decompose': {
            const supervisorId = params.supervisor_id as string;
            const task = params.task as string;
            const subtasks = params.subtasks as Array<{
              name: string;
              description: string;
              type: 'subagent' | 'teammate';
              dependencies?: string[];
            }>;

            if (!supervisorId) {
              return errorResult('supervisor_id is required for decompose action');
            }
            if (!task) {
              return errorResult('task is required for decompose action');
            }
            if (!subtasks || !Array.isArray(subtasks)) {
              return errorResult('subtasks is required for decompose action');
            }

            const taskIds = await decomposeTasks(supervisorId, task, subtasks);

            return {
              content: JSON.stringify({
                supervisor_id: supervisorId,
                task,
                task_ids: taskIds,
                message: `Decomposed into ${taskIds.length} subtasks`,
              }, null, 2),
            };
          }

          case 'delegate': {
            const supervisorId = params.supervisor_id as string;
            const taskId = params.task_id as string;
            const nodeId = params.node_id as string | undefined;

            if (!supervisorId) {
              return errorResult('supervisor_id is required for delegate action');
            }
            if (!taskId) {
              return errorResult('task_id is required for delegate action');
            }

            await delegateTask(supervisorId, taskId, nodeId);

            return {
              content: JSON.stringify({
                supervisor_id: supervisorId,
                task_id: taskId,
                node_id: nodeId || null,
                message: `Task ${taskId} delegated`,
              }, null, 2),
            };
          }

          case 'status': {
            const supervisorId = params.supervisor_id as string;

            if (!supervisorId) {
              return errorResult('supervisor_id is required for status action');
            }

            const status = await getSupervisorStatus(supervisorId);
            if (!status) {
              return errorResult(`Supervisor ${supervisorId} not found`);
            }

            const tasks = await getAllTasks(supervisorId);

            return {
              content: JSON.stringify({
                supervisor_id: status.supervisorId,
                session_id: status.sessionId,
                status: status.status,
                current_iteration: status.currentIteration,
                tasks: tasks.map(t => ({
                  id: t.id,
                  name: t.name,
                  type: t.type,
                  status: t.status,
                  result: t.result || null,
                  error: t.error || null,
                })),
                results_count: Object.keys(status.results).length,
              }, null, 2),
            };
          }

          case 'collect': {
            const supervisorId = params.supervisor_id as string;

            if (!supervisorId) {
              return errorResult('supervisor_id is required for collect action');
            }

            const results = await collectSupervisorResults(supervisorId);

            return {
              content: JSON.stringify({
                supervisor_id: supervisorId,
                results,
                count: Object.keys(results).length,
              }, null, 2),
            };
          }

          case 'terminate': {
            const supervisorId = params.supervisor_id as string;

            if (!supervisorId) {
              return errorResult('supervisor_id is required for terminate action');
            }

            await terminateSupervisor(supervisorId);

            return {
              content: JSON.stringify({
                supervisor_id: supervisorId,
                message: `Supervisor ${supervisorId} terminated`,
              }, null, 2),
            };
          }

          default:
            return errorResult(`Unknown action: ${action}`);
        }
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}

/**
 * 便捷导出
 */
export { createSupervisorTool as default };
