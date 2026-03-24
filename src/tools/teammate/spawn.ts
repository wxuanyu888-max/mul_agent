/**
 * teammate_spawn - 创建队友工具
 */

import { jsonResult, errorResult } from "../types.js";

/**
 * 创建 teammate_spawn 工具
 */
export function createTeammateSpawnTool() {
  return {
    label: "Teammate Spawn",
    name: "teammate_spawn",
    description: `Create a new teammate agent. Give them a name and role, and they will start working independently.

## 交接文档要求（必须遵守）
创建 teammate 前，必须使用 memory 工具的 write 功能写入 handover 类型的记忆，包含：
- task_goal: 任务目标
- completed_steps: 已完成的步骤
- pending_steps: 待完成的步骤
- key_context: 关键上下文

请先写入 handover，再创建 teammate。`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique name for the teammate',
        },
        role: {
          type: 'string',
          description: 'Role of the teammate (e.g., coder, reviewer, planner)',
        },
        prompt: {
          type: 'string',
          description: 'Optional additional instructions for the teammate',
        },
      },
      required: ['name', 'role'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const name = params.name as string;
        const role = params.role as string;
        const prompt = params.prompt as string | undefined;

        if (!name || !role) {
          return errorResult('name and role are required');
        }

        // 动态导入以避免循环依赖
        const { spawnTeammate } = await import('../../agents/teammate.js');
        const result = await spawnTeammate({ name, role, prompt });

        return jsonResult({ result });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}
