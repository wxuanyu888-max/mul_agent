/**
 * Agent 步骤执行模块
 *
 * 负责单个 Agent 步骤的执行：发起请求 → 等待完成 → 读取回复
 */

import { callGateway } from './gateway.js';
import type { Message } from './types.js';

/**
 * Agent 步骤参数
 */
export interface AgentStepParams {
  sessionKey: string;
  message: string;
  extraSystemPrompt?: string;
  timeoutMs?: number;
  channel?: string;
  lane?: string;
  sourceSessionKey?: string;
  sourceChannel?: string;
  sourceTool?: string;
}

/**
 * Agent 步骤结果
 */
export interface AgentStepResult {
  stepId: string;
  runId: string;
  reply?: string;
  success: boolean;
  error?: string;
}

/**
 * 运行 Agent 步骤
 *
 * 流程：
 * 1. 生成唯一步骤 ID
 * 2. 调用 Gateway "agent" 方法发起请求
 * 3. 调用 Gateway "agent.wait" 方法等待完成
 * 4. 读取最新助手回复
 */
export async function runAgentStep(params: AgentStepParams): Promise<AgentStepResult> {
  const {
    sessionKey,
    message,
    extraSystemPrompt = '',
    timeoutMs = 120000,
    channel = 'web',
    lane = 'default',
    sourceSessionKey,
    sourceChannel,
    sourceTool,
  } = params;

  const stepIdem = generateId();

  try {
    // 1. 发起 Agent 请求
    const response = await callGateway<{ runId?: string }>({
      method: 'agent',
      params: {
        message,
        sessionKey,
        idempotencyKey: stepIdem,
        deliver: false,
        channel,
        lane,
        extraSystemPrompt,
        inputProvenance: sourceSessionKey
          ? {
              kind: 'inter_session',
              sourceSessionKey,
              sourceChannel,
              sourceTool: sourceTool ?? 'sessions_send',
            }
          : { kind: 'user' },
      },
      timeoutMs: 10000,
    });

    const stepRunId = typeof response?.runId === 'string' && response.runId
      ? response.runId
      : stepIdem;

    // 2. 等待 Agent 完成
    const stepWaitMs = Math.min(timeoutMs, 60000);
    const wait = await callGateway<{ status?: string }>({
      method: 'agent.wait',
      params: {
        runId: stepRunId,
        timeoutMs: stepWaitMs,
      },
      timeoutMs: stepWaitMs + 2000,
    });

    if (wait?.status !== 'ok') {
      return {
        stepId: stepIdem,
        runId: stepRunId,
        success: false,
        error: 'Agent wait failed',
      };
    }

    // 3. 读取最新回复
    const reply = await readLatestAssistantReply({ sessionKey });

    return {
      stepId: stepIdem,
      runId: stepRunId,
      reply,
      success: true,
    };
  } catch (error) {
    return {
      stepId: stepIdem,
      runId: stepIdem,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 读取最新助手回复
 */
export async function readLatestAssistantReply(params: {
  sessionKey: string;
  limit?: number;
}): Promise<string | undefined> {
  const { sessionKey, limit = 50 } = params;

  try {
    const history = await callGateway<{ messages: unknown[] }>({
      method: 'chat.history',
      params: { sessionKey, limit },
      timeoutMs: 5000,
    });

    const messages = Array.isArray(history?.messages) ? history.messages : [];

    // 从后向前查找最新的助手文本回复
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      if (!msg || typeof msg !== 'object') {
        continue;
      }

      const msgObj = msg as Record<string, unknown>;

      // 跳过非助手消息
      if (msgObj.role !== 'assistant') {
        continue;
      }

      // 提取文本内容
      const content = msgObj.content;

      if (typeof content === 'string') {
        const text = content.trim();
        if (text) {
          return text;
        }
      }

      // 处理内容数组
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && typeof block === 'object') {
            const blockObj = block as Record<string, unknown>;
            if (blockObj.type === 'text' && typeof blockObj.text === 'string') {
              const text = blockObj.text.trim();
              if (text) {
                return text;
              }
            }
          }
        }
      }
    }

    return undefined;
  } catch (error) {
    console.error('Error reading assistant reply:', error);
    return undefined;
  }
}

/**
 * 过滤工具消息，只保留用户和助手消息
 */
export function stripToolMessages(messages: unknown[]): unknown[] {
  return messages.filter((msg) => {
    if (!msg || typeof msg !== 'object') {
      return false;
    }
    const msgObj = msg as Record<string, unknown>;
    const role = msgObj.role;

    // 过滤掉工具角色
    return role !== 'tool';
  });
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return crypto.randomUUID();
}
