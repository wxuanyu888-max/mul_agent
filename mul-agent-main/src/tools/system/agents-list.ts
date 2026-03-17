// Agents List 工具
import { jsonResult, errorResult } from "../types.js";

export function createAgentsListTool() {
  return {
    label: "Agents",
    name: "agents_list",
    description: "List available agent IDs",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (_toolCallId: string) => {
      try {
        return jsonResult({ agents: ["core"] });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
