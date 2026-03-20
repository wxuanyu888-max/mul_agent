/**
 * LLM 客户端
 *
 * 负责实际调用 LLM API (MiniMax - Anthropic 兼容)
 * 只包含业务逻辑，日志由 logger 模块统一处理
 */

import {
  getApiKey,
  getBaseUrl,
  getDefaultModel,
  getTemperature,
  getMaxTokens,
} from './config.js';
import { logLlmCall } from '../logger/index.js';
import type { Message } from './types.js';

/**
 * LLM 请求参数 (Anthropic 格式)
 */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_call_id?: string;  // 用于 tool_result 消息
  name?: string;          // 用于 tool_result 消息（指定工具名）
}

export interface LLMRequest {
  model: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
  messages: LLMMessage[];
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
}

/**
 * LLM 响应 (Anthropic 格式)
 */
export interface LLMResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: 'text' | 'thinking' | 'tool_use';
    text?: string;
    thinking?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * LLM 客户端 (Anthropic 兼容)
 */
export class LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    this.apiKey = getApiKey();
    this.baseUrl = getBaseUrl();
    this.model = getDefaultModel();
    this.temperature = getTemperature();
    this.maxTokens = getMaxTokens();
  }

  /**
   * 发送聊天请求
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.baseUrl}/v1/messages`;

    const body: LLMRequest = {
      model: request.model ?? this.model,
      max_tokens: request.max_tokens ?? this.maxTokens,
      temperature: request.temperature ?? this.temperature,
      messages: request.messages,
    };

    if (request.system) {
      body.system = request.system;
    }

    // 注入 tools 参数
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    const startTime = Date.now();

    // 保存请求信息用于日志
    const requestInfo = {
      model: body.model || this.model,
      prompt: body.messages.map(m => m.content).join('\n'),
      temperature: body.temperature ?? this.temperature,
      max_tokens: body.max_tokens ?? this.maxTokens,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();

      // 记录错误日志
      await logLlmCall({
        provider: 'minimax',
        model: requestInfo.model,
        agentId: 'default',
        latencyMs: elapsed,
        success: false,
        error: error,
      });

      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as LLMResponse;

    // 内容预览
    const textBlock = data.content?.find((b) => b.type === 'text');
    const responseText = textBlock?.text || '';

    // 记录到 storage/llm_logs/ (使用统一日志系统 - 包含完整输入输出)
    await logLlmCall({
      provider: 'minimax',
      model: data.model,
      agentId: 'default',
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      latencyMs: elapsed,
      success: true,
      finishReason: data.stop_reason,
      rawRequest: {
        model: requestInfo.model,
        messages: body.messages,
        system: body.system,
        tools: body.tools,
      },
      rawResponse: data, // 保存完整的API响应，包括tool_calls
    });

    return data;
  }

  /**
   * 简单聊天 (只传用户消息)
   */
  async chatSimple(userMessage: string, systemPrompt?: string, tools?: LLMRequest['tools']): Promise<string> {
    const messages = [
      {
        role: 'user' as const,
        content: userMessage,
      },
    ];

    const response = await this.chat({
      model: this.model,
      system: systemPrompt,
      messages,
      tools,
    });

    return this.extractText(response);
  }

  /**
   * 带上下文的聊天
   */
  async chatWithContext(
    userMessage: string,
    history: Message[],
    systemPrompt?: string,
    tools?: LLMRequest['tools']
  ): Promise<string> {
    const messages: LLMRequest['messages'] = [];

    // 添加历史消息
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // 添加当前消息
    messages.push({
      role: 'user',
      content: userMessage,
    });

    const response = await this.chat({
      model: this.model,
      system: systemPrompt,
      messages,
      tools,
    });

    return this.extractText(response);
  }

  /**
   * 从响应中提取文本
   */
  private extractText(response: LLMResponse): string {
    const textBlocks = response.content.filter(
      (block) => block.type === 'text'
    );

    if (textBlocks.length === 0) {
      return '';
    }

    return textBlocks.map((block) => block.text || '').join('\n');
  }
}

// 全局客户端实例
let globalClient: LLMClient | null = null;

/**
 * 获取全局 LLM 客户端
 */
export function getLLMClient(): LLMClient {
  if (!globalClient) {
    globalClient = new LLMClient();
  }
  return globalClient;
}

/**
 * 便捷函数：发送聊天
 */
export async function chat(
  userMessage: string,
  systemPrompt?: string,
  tools?: LLMRequest['tools']
): Promise<string> {
  const client = getLLMClient();
  return client.chatSimple(userMessage, systemPrompt, tools);
}

/**
 * 便捷函数：带上下文聊天
 */
export async function chatWithContext(
  userMessage: string,
  history: Message[],
  systemPrompt?: string,
  tools?: LLMRequest['tools']
): Promise<string> {
  const client = getLLMClient();
  return client.chatWithContext(userMessage, history, systemPrompt, tools);
}
