// Sessions Spawn 工具
import { jsonResult, errorResult } from "../types.js";
import { createSession } from "../../session/index.js";

export function createSessionsSpawnTool() {
  return {
    label: "Sessions Spawn",
    name: "sessions_spawn",
    description: 'Spawn an isolated sub-agent session (runtime="subagent")',
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Initial task for the sub-agent" },
        label: { type: "string", description: "Session label" },
        runtime: { type: "string", default: "subagent", enum: ["main", "subagent"] },
        model: { type: "string", description: "Model to use" },
        timeoutSeconds: { type: "number", description: "Timeout in seconds" },
        systemPrompt: { type: "string", description: "Custom system prompt" },
      },
      required: ["task"],
    },
    execute: async (
      _toolCallId: string,
      params: {
        task: string;
        label?: string;
        runtime?: string;
        model?: string;
        timeoutSeconds?: number;
        systemPrompt?: string;
      },
    ) => {
      try {
        const session = await createSession({
          label: params.label,
          config: {
            runtime: (params.runtime as 'main' | 'subagent') || 'subagent',
            model: params.model,
            timeoutSeconds: params.timeoutSeconds,
            systemPrompt: params.systemPrompt,
          },
        });

        // 添加初始任务消息
        const { addMessage } = await import("../../session/index.js");
        await addMessage(session.id, {
          role: 'user',
          content: { type: 'text', text: params.task },
        });

        return jsonResult({
          sessionId: session.id,
          task: params.task,
          status: session.status,
          runtime: session.config.runtime,
        });
      } catch (error) {
        return errorResult(`Failed to spawn session: ${error}`);
      }
    },
  };
}
