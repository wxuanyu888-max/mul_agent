// Session Status 工具
import { jsonResult, errorResult } from "../types.js";
import { getSession, updateSessionStatus } from "../../session/index.js";

export function createSessionStatusTool() {
  return {
    label: "Session Status",
    name: "session_status",
    description: "Show current session usage and status",
    parameters: {
      type: "object",
      properties: {
        sessionKey: { type: "string", description: "Session ID (optional, defaults to current)" },
        action: { type: "string", enum: ["get", "idle", "complete", "error"], description: "Action to perform" },
      },
    },
    execute: async (
      _toolCallId: string,
      params?: { sessionKey?: string; action?: string },
    ) => {
      try {
        const sessionKey = params?.sessionKey;

        // 如果指定了 sessionKey，获取该 session 的状态
        if (sessionKey) {
          const session = await getSession(sessionKey);

          if (!session) {
            return errorResult(`Session not found: ${sessionKey}`);
          }

          // 执行状态操作
          if (params?.action === 'idle') {
            await updateSessionStatus(sessionKey, 'idle');
            return jsonResult({ sessionId: sessionKey, status: 'idle' });
          }
          if (params?.action === 'complete') {
            await updateSessionStatus(sessionKey, 'completed');
            return jsonResult({ sessionId: sessionKey, status: 'completed' });
          }
          if (params?.action === 'error') {
            await updateSessionStatus(sessionKey, 'error');
            return jsonResult({ sessionId: sessionKey, status: 'error' });
          }

          return jsonResult({
            sessionId: session.id,
            label: session.label,
            status: session.status,
            runtime: session.config.runtime,
            model: session.config.model,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages.length,
            toolCallCount: session.toolCalls.length,
            usage: session.usage,
          });
        }

        // 没有指定 sessionKey，返回活跃 session 数量
        const { getActiveSessions } = await import("../../session/index.js");
        const activeSessions = await getActiveSessions();

        return jsonResult({
          activeSessionCount: activeSessions.length,
          sessions: activeSessions.map((s) => ({
            id: s.id,
            label: s.label,
            status: s.status,
            runtime: s.config.runtime,
          })),
        });
      } catch (error) {
        return errorResult(`Failed to get status: ${error}`);
      }
    },
  };
}
