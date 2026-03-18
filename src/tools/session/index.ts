// Sessions 工具 - 统一入口
import { jsonResult, errorResult } from "../types.js";
import { querySessions, createSession, getSession, addMessage, getActiveSessions } from "../../session/index.js";

export function createSessionsTool() {
  return {
    label: "Sessions",
    name: "sessions",
    description: `Session management. Available actions:
- sessions_list: List all sessions
- sessions_history: View session history
- sessions_send: Send message to another session
- sessions_spawn: Create new session
- session_status: Get current session status`,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "history", "send", "spawn", "status"],
          description: "Action to perform"
        },
        // list 参数
        status: { type: "string", enum: ["active", "idle", "completed", "error"], description: "Filter by status" },
        parentId: { type: "string", description: "Filter by parent session" },
        label: { type: "string", description: "Filter by label" },
        limit: { type: "number", description: "Max results", default: 20 },
        // history 参数
        sessionKey: { type: "string", description: "Session ID to fetch history from" },
        offset: { type: "number", description: "Offset from the start" },
        // send 参数
        message: { type: "string", description: "Message to send" },
        // spawn 参数
        task: { type: "string", description: "Initial task for the sub-agent" },
        runtime: { type: "string", default: "subagent", enum: ["main", "subagent"] },
        model: { type: "string", description: "Model to use" },
        timeoutSeconds: { type: "number", description: "Timeout in seconds" },
        systemPrompt: { type: "string", description: "Custom system prompt" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: {
      action: "list" | "history" | "send" | "spawn" | "status";
      status?: string;
      parentId?: string;
      label?: string;
      limit?: number;
      sessionKey?: string;
      offset?: number;
      message?: string;
      task?: string;
      runtime?: string;
      model?: string;
      timeoutSeconds?: number;
      systemPrompt?: string;
    }) => {
      try {
        const { action } = params;

        switch (action) {
          case "list": {
            const { status, parentId, label, limit } = params;
            const sessions = await querySessions({
              status: status as any,
              parentId,
              label,
              limit: limit || 20,
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
          }

          case "history": {
            const { sessionKey, limit = 50, offset = 0 } = params;
            if (!sessionKey) {
              return errorResult("sessionKey is required for history action");
            }
            const session = await getSession(sessionKey);
            if (!session) {
              return errorResult(`Session ${sessionKey} not found`);
            }
            const messages = (session.messages || []).slice(offset, offset + limit);
            return jsonResult({
              sessionId: sessionKey,
              messages: messages.map((m) => {
                const content = Array.isArray(m.content)
                  ? m.content[0]?.text || ''
                  : typeof m.content === 'object'
                    ? (m.content as any).text || ''
                    : m.content;
                return {
                  role: m.role,
                  content,
                };
              }),
              total: session.messages?.length || 0,
            });
          }

          case "send": {
            const { sessionKey, message } = params;
            if (!sessionKey || !message) {
              return errorResult("sessionKey and message are required for send action");
            }
            await addMessage(sessionKey, {
              role: 'user',
              content: { type: 'text', text: message },
            });
            return jsonResult({
              sessionId: sessionKey,
              message: "Message sent",
            });
          }

          case "spawn": {
            const { task, label, runtime, model, timeoutSeconds, systemPrompt } = params;
            if (!task) {
              return errorResult("task is required for spawn action");
            }
            const session = await createSession({
              label,
              config: {
                runtime: (runtime as 'main' | 'subagent') || 'subagent',
                model,
                timeoutSeconds,
                systemPrompt,
              },
            });
            await addMessage(session.id, {
              role: 'user',
              content: { type: 'text', text: task },
            });
            return jsonResult({
              sessionId: session.id,
              task,
              status: session.status,
              runtime: session.config.runtime,
            });
          }

          case "status": {
            const { sessionKey } = params;
            if (!sessionKey) {
              return errorResult("sessionKey is required for status action");
            }
            const session = await getSession(sessionKey);
            if (!session) {
              return errorResult(`Session ${sessionKey} not found`);
            }
            return jsonResult({
              sessionId: session.id,
              status: session.status,
              label: session.label,
              parentId: session.parentId,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
              messageCount: session.messages?.length || 0,
            });
          }

          default:
            return errorResult(`Unknown action: ${action}`);
        }
      } catch (error) {
        return errorResult(`Sessions operation failed: ${error}`);
      }
    },
  };
}

// 兼容旧接口
export { createSessionsListTool } from "./list.js";
export { createSessionsHistoryTool } from "./history.js";
export { createSessionsSendTool } from "./send.js";
export { createSessionsSpawnTool } from "./spawn.js";
export { createSessionStatusTool } from "./status.js";
