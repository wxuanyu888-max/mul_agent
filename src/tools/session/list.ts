// Sessions List 工具
import { jsonResult, errorResult } from "../types.js";
import { querySessions } from "../../session/index.js";

export function createSessionsListTool() {
  return {
    label: "Sessions",
    name: "sessions_list",
    description: "List all active sessions",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "idle", "completed", "error"] },
        parentId: { type: "string" },
        label: { type: "string" },
        limit: { type: "number", default: 20 },
      },
    },
    execute: async (_toolCallId: string, params?: { status?: string; parentId?: string; label?: string; limit?: number }) => {
      try {
        const sessions = await querySessions({
          status: params?.status as any,
          parentId: params?.parentId,
          label: params?.label,
          limit: params?.limit || 20,
        });

        return jsonResult({
          sessions: sessions.map((s) => ({
            id: s.id,
            label: s.label,
            parentId: s.parentId,
            status: s.status,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            runtime: s.config.runtime,
            model: s.config.model,
          })),
          count: sessions.length,
        });
      } catch (error) {
        return errorResult(`Failed to list sessions: ${error}`);
      }
    },
  };
}
