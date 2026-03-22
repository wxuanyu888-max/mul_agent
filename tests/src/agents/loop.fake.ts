/**
 * AgentLoop Test Fakes - 提供可控的测试替代品
 */

import type { LLMResponse } from '../../../src/agents/llm.js';
import type { Message } from '../../../src/agents/types.js';

// ============================================================
// Fake LLM Client
// ============================================================

export interface FakeLLMResponse extends Partial<LLMResponse> {
  content?: string;
  stop_reason?: 'stop' | 'tool_use' | 'end_turn' | null;
  tool_calls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class FakeLLMClient {
  private responses: FakeLLMResponse[];
  private callCount = 0;
  private callHistory: Array<{
    request: unknown;
    timestamp: number;
  }> = [];

  constructor(responses: FakeLLMResponse[] = []) {
    this.responses = responses;
  }

  setResponses(responses: FakeLLMResponse[]): void {
    this.responses = responses;
    this.callCount = 0;
  }

  async chat(request: unknown): Promise<LLMResponse> {
    this.callCount++;
    this.callHistory.push({ request, timestamp: Date.now() });

    const response = this.responses[0] ?? {
      content: 'Default response',
      stop_reason: 'stop',
      tool_calls: [],
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    // 如果有多个响应，按顺序返回
    if (this.callCount <= this.responses.length) {
      const r = this.responses[this.callCount - 1];
      return {
        content: r.content ?? [],
        stop_reason: r.stop_reason ?? null,
        tool_calls: r.tool_calls ?? [],
        usage: r.usage ?? { input_tokens: 10, output_tokens: 5 },
        ...r,
      } as LLMResponse;
    }

    // 超出数组长度，返回最后一个或默认
    return {
      content: response.content ?? [],
      stop_reason: response.stop_reason ?? null,
      tool_calls: response.tool_calls ?? [],
      usage: response.usage ?? { input_tokens: 10, output_tokens: 5 },
    } as LLMResponse;
  }

  getCallCount(): number {
    return this.callCount;
  }

  getCallHistory(): Array<{ request: unknown; timestamp: number }> {
    return [...this.callHistory];
  }

  reset(): void {
    this.callCount = 0;
    this.callHistory = [];
  }
}

// ============================================================
// Fake Tool
// ============================================================

export interface FakeToolConfig {
  name: string;
  description?: string;
  parameters?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute?: (toolCallId: string, params: Record<string, unknown>) => Promise<{
    content: string;
    error?: string;
  }>;
  requiresConfirmation?: boolean;
}

export class FakeTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  readonly requiresConfirmation?: boolean;
  readonly execute: (toolCallId: string, params: Record<string, unknown>) => Promise<{
    content: string;
    error?: string;
  }>;

  private executionLog: Array<{
    toolCallId: string;
    params: Record<string, unknown>;
    timestamp: number;
  }> = [];

  constructor(config: FakeToolConfig) {
    this.name = config.name;
    this.description = config.description ?? `Fake tool: ${config.name}`;
    this.parameters = config.parameters ?? {
      type: 'object',
      properties: {},
    };
    this.requiresConfirmation = config.requiresConfirmation;
    this.execute = config.execute ?? (async () => ({
      content: JSON.stringify({ result: 'ok' }),
    }));
  }

  getExecutionLog(): Array<{
    toolCallId: string;
    params: Record<string, unknown>;
    timestamp: number;
  }> {
    return [...this.executionLog];
  }

  resetLog(): void {
    this.executionLog = [];
  }
}

// ============================================================
// Fake Background Manager
// ============================================================

export interface BackgroundNotification {
  taskId: string;
  status: 'completed' | 'timeout' | 'error';
  output: string;
  error?: string;
}

export class FakeBackgroundManager {
  private notifications: BackgroundNotification[] = [];

  addNotification(notification: BackgroundNotification): void {
    this.notifications.push(notification);
  }

  drainNotifications(): BackgroundNotification[] {
    const drained = [...this.notifications];
    this.notifications = [];
    return drained;
  }

  hasNotifications(): boolean {
    return this.notifications.length > 0;
  }
}

// ============================================================
// Fake Skill Loader
// ============================================================

import type { SkillEntry } from '../../../src/skills/index.js';

export class FakeSkillLoader {
  private skills: SkillEntry[] = [];
  private loadError: Error | null = null;
  private loadCallCount = 0;

  setSkills(skills: SkillEntry[]): void {
    this.skills = skills;
    this.loadError = null;
  }

  setLoadError(error: Error): void {
    this.loadError = error;
    this.skills = [];
  }

  getLoadCallCount(): number {
    return this.loadCallCount;
  }

  reset(): void {
    this.skills = [];
    this.loadError = null;
    this.loadCallCount = 0;
  }
}

// ============================================================
// Helper: 创建简单的文本响应
// ============================================================

export const textResponse = (
  content: string,
  usage = { input_tokens: 100, output_tokens: 50 }
): FakeLLMResponse => ({
  content: [{ type: 'text' as const, text: content }],
  stop_reason: 'stop',
  usage,
});

// ============================================================
// Helper: 创建工具调用响应
// ============================================================

export const toolCallResponse = (
  toolName: string,
  toolInput: Record<string, unknown>,
  content = 'I need to use a tool'
): FakeLLMResponse => ({
  content: [{ type: 'text' as const, text: content }],
  stop_reason: 'tool_use',
  tool_calls: [
    {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: toolName,
      input: toolInput,
    },
  ],
  usage: { input_tokens: 100, output_tokens: 50 },
});

// ============================================================
// Helper: 创建错误响应
// ============================================================

export const errorResponse = (errorMessage: string): FakeLLMResponse => ({
  content: [],
  stop_reason: 'stop',
  usage: { input_tokens: 0, output_tokens: 0 },
});

// ============================================================
// Helper: 创建工具执行结果
// ============================================================

export const toolResult = (
  content: string,
  isError = false
): { content: string; error?: string } => ({
  content,
  ...(isError && { error: content }),
});
