/**
 * Token Usage API Routes
 */

import { Router, Request, Response } from 'express';
import { queryLlmLogs, type LlmCallLog } from '../../logger/llm.js';

interface TokenUsageSummary {
  agent_id: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  access_count: number;
  last_access_time: string | null;
  updated_at: string | null;
}

interface TokenUsageDetails {
  summary: TokenUsageSummary;
  details: {
    by_model: Record<string, unknown>;
    by_function: Record<string, unknown>;
    by_date: Record<string, unknown>;
  };
  llm_logs: unknown[];
}

/**
 * 将 LLM 日志转换为前端兼容格式
 */
function transformLlmLogForFrontend(log: LlmCallLog): Record<string, unknown> {
  // 构建完整的输入文本（包含所有消息）
  let inputText = '';
  if (log.rawRequest?.system) {
    inputText += `[System]: ${log.rawRequest.system}\n\n`;
  }
  if (log.rawRequest?.messages) {
    for (const msg of log.rawRequest.messages) {
      const role = msg.role || 'unknown';
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      inputText += `[${role}]: ${content}\n`;
    }
  }

  // 构建完整的输出文本
  let outputText = '-';
  let toolCalls: Array<{ name: string; input: string }> = [];

  if (log.rawResponse?.content) {
    // content 可能是字符串，也可能是数组
    if (typeof log.rawResponse.content === 'string') {
      outputText = log.rawResponse.content;
    } else if (Array.isArray(log.rawResponse.content)) {
      // 遍历找到 type === 'text' 的元素
      const textBlock = log.rawResponse.content.find((b: any) => b.type === 'text');
      outputText = textBlock?.text || '-';
    }
  }

  // 提取 tool_calls 和 tool_results
  // 关键：只从 rawRequest.messages 中最后一条 assistant 消息提取 tool_calls
  // 因为每条 LLM 日志都包含完整历史，只取最后一条才能避免重复统计
  interface ToolCallWithResult {
    id: string;
    name: string;
    input: string;
    output?: string;
  }
  const toolCallsMap: Map<string, ToolCallWithResult> = new Map();

  if (log.rawRequest?.messages) {
    const messages = log.rawRequest.messages;

    // 找到最后一条 assistant 消息（包含本次 LLM 调用返回的 tool_calls）
    let lastAssistantMsg = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].content) {
        lastAssistantMsg = messages[i];
        break;
      }
    }

    // 从最后一条 assistant 消息提取 tool_calls
    if (lastAssistantMsg) {
      const content = typeof lastAssistantMsg.content === 'string' ? lastAssistantMsg.content : '';
      try {
        const toolCallsMatch = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
        if (toolCallsMatch) {
          const parsed = JSON.parse(toolCallsMatch[0]);
          if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
            for (const tc of parsed.tool_calls) {
              const id = tc.id || tc.function?.id || `tc_${Math.random().toString(36).substring(7)}`;
              const name = tc.name || tc.function?.name || 'unknown';
              const input = typeof tc.input === 'string'
                ? tc.input
                : JSON.stringify(tc.input || tc.function?.arguments || {});
              toolCallsMap.set(id, { id, name, input });
            }
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 提取 user 消息中的 tool_result（通过 tool_call_id 关联）
    // 这里遍历所有 user 消息，找到对应的 tool_result
    for (const msg of messages) {
      if (msg.role === 'user' && msg.tool_call_id && msg.content) {
        const existing = toolCallsMap.get(msg.tool_call_id);
        if (existing) {
          existing.output = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        }
      }
    }
  }

  // 也尝试从 rawResponse 提取 tool_calls（如果有的话）
  if (log.rawResponse?.tool_calls && Array.isArray(log.rawResponse.tool_calls)) {
    for (const tc of log.rawResponse.tool_calls) {
      const id = tc.id || `tc_${Math.random().toString(36).substring(7)}`;
      const name = tc.function?.name || tc.name || 'unknown';
      const input = typeof tc.function?.arguments === 'string'
        ? tc.function.arguments
        : JSON.stringify(tc.function?.arguments || {});
      if (!toolCallsMap.has(id)) {
        toolCallsMap.set(id, { id, name, input });
      }
    }
  }

  // 转换为数组
  toolCalls = Array.from(toolCallsMap.values());

  return {
    timestamp: new Date(log.timestamp).toISOString(),
    model: log.model,
    function: 'chat', // 默认设为 chat
    input_tokens: log.promptTokens || 0,
    output_tokens: log.completionTokens || 0,
    input_text: inputText || '-',
    output_text: outputText,
    tool_calls: toolCalls,
    // 保留完整原始数据供展开查看
    raw_request: log.rawRequest,
    raw_response: log.rawResponse,
    extra: {
      input: inputText || '-',
      output: outputText,
      rawRequest: log.rawRequest,
      rawResponse: log.rawResponse,
    },
  };
}

// In-memory token usage storage
const tokenUsageStore: Record<string, TokenUsageDetails> = {};

export function createTokenRouter(): Router {
  const router = Router();

  // GET /token-usage
  router.get('/token-usage', async (req: Request, res: Response) => {
    const allUsage: Record<string, TokenUsageSummary> = {};

    // 先从内存存储获取
    for (const [agent_id, details] of Object.entries(tokenUsageStore)) {
      allUsage[agent_id] = details.summary;
    }

    // 查询 LLM 日志中的所有 agent
    const logs = await queryLlmLogs({ limit: 1000 });
    const agentIds = new Set(
      logs.map((log) => log.agentId).filter((id): id is string => Boolean(id))
    );

    // 为每个有日志的 agent 添加统计
    for (const agentId of agentIds) {
      if (!allUsage[agentId]) {
        // 计算该 agent 的 token 统计
        const agentLogs = logs.filter((log) => log.agentId === agentId);
        const totalInput = agentLogs.reduce((sum, log) => sum + (log.promptTokens || 0), 0);
        const totalOutput = agentLogs.reduce((sum, log) => sum + (log.completionTokens || 0), 0);
        const lastLog = agentLogs.sort((a, b) => b.timestamp - a.timestamp)[0];

        allUsage[agentId] = {
          agent_id: agentId,
          total_tokens: totalInput + totalOutput,
          input_tokens: totalInput,
          output_tokens: totalOutput,
          access_count: agentLogs.length,
          last_access_time: lastLog ? new Date(lastLog.timestamp).toISOString() : null,
          updated_at: lastLog ? new Date(lastLog.timestamp).toISOString() : null,
        };
      }
    }

    res.json({ all_usage: allUsage });
  });

  // GET /token-usage/:agent_id
  router.get('/token-usage/:agent_id', async (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;

    if (!tokenUsageStore[agent_id]) {
      // 即使没有统计数据，也尝试获取日志
      const logs = await queryLlmLogs({ agentId: agent_id, limit: 100 });
      const transformedLogs = logs.map(transformLlmLogForFrontend);
      res.json({
        summary: {
          agent_id,
          total_tokens: 0,
          input_tokens: 0,
          output_tokens: 0,
          access_count: 0,
          last_access_time: null,
          updated_at: null
        },
        details: {
          by_model: {},
          by_function: {},
          by_date: {}
        },
        llm_logs: transformedLogs
      });
      return;
    }

    // 获取日志数据并转换格式
    const logs = await queryLlmLogs({ agentId: agent_id, limit: 100 });
    const transformedLogs = logs.map(transformLlmLogForFrontend);
    res.json({
      ...tokenUsageStore[agent_id],
      llm_logs: transformedLogs
    });
  });

  // POST /token-usage/:agent_id/reset
  router.post('/token-usage/:agent_id/reset', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;

    if (tokenUsageStore[agent_id]) {
      delete tokenUsageStore[agent_id];
    }

    res.json({ status: 'success', message: `Token usage reset for agent ${agent_id}` });
  });

  return router;
}
