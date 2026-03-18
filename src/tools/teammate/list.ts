/**
 * teammate_list - 列出队友工具
 */

import { jsonResult, errorResult } from "../types.js";

/**
 * 创建 teammate_list 工具
 */
export function createTeammateListTool() {
  return {
    label: "Teammate List",
    name: "teammate_list",
    description: 'List all teammates and their status (WORKING, IDLE, or SHUTDOWN).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async (_toolCallId: string, _params: Record<string, unknown>) => {
      try {
        // 动态导入以避免循环依赖
        const { listTeammates } = await import('../../agents/teammate.js');
        const teammates = listTeammates();

        return jsonResult({ teammates });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}
