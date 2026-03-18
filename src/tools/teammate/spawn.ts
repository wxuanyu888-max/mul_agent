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
    description: 'Create a new teammate agent with a specific role. The teammate will run independently and can receive messages from other teammates.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the teammate',
        },
        role: {
          type: 'string',
          description: 'Role of the teammate (e.g., coder, reviewer, planner)',
        },
        prompt: {
          type: 'string',
          description: 'Optional system prompt for the teammate',
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
