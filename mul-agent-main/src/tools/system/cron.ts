// Cron 工具
import { jsonResult, errorResult } from "../types.js";

export function createCronTool() {
  return {
    label: "Cron",
    name: "cron",
    description: "Manage cron jobs and wake events",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "create", "delete"] },
        schedule: { type: "string" },
        task: { type: "string" },
        label: { type: "string" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: { action: string; schedule?: string; task?: string; label?: string }) => {
      try {
        return jsonResult({ action: params.action, jobs: [] });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
