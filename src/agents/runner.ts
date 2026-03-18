/**
 * Agent 运行器
 *
 * 核心执行逻辑：接收消息 → 执行 Agent → 返回响应
 */

import { callGateway } from './gateway.js';
import type {
  AgentRunConfig,
  AgentRunResult,
  Message,
  ReplyPayload,
  QueueSettings,
  FollowupRun,
  Usage,
} from './types.js';
import { AgentState } from './types.js';
import { readLatestAssistantReply } from './step.js';

/**
 * Agent 运行器配置
 */
export interface AgentRunnerOptions {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTimeout?: number;
}

/**
 * Agent 运行器
 */
export class AgentRunner {
  private options: Required<AgentRunnerOptions>;

  constructor(options: AgentRunnerOptions = {}) {
    this.options = {
      defaultModel: options.defaultModel ?? 'claude-sonnet-4-20250514',
      defaultTemperature: options.defaultTemperature ?? 0.7,
      defaultMaxTokens: options.defaultMaxTokens ?? 4096,
      defaultTimeout: options.defaultTimeout ?? 120000,
    };
  }

  /**
   * 运行 Agent 处理消息
   */
  async run(params: {
    commandBody: string;
    sessionKey: string;
    channel?: string;
    lane?: string;
    isHeartbeat?: boolean;
    shouldSteer?: boolean;
    shouldFollowup?: boolean;
    isStreaming?: boolean;
    extraSystemPrompt?: string;
    queueSettings?: QueueSettings;
  }): Promise<ReplyPayload | ReplyPayload[] | undefined> {
    const {
      commandBody,
      sessionKey,
      channel = 'web',
      lane = 'default',
      isHeartbeat = false,
      shouldSteer = false,
      shouldFollowup = false,
      isStreaming = false,
      extraSystemPrompt = '',
      queueSettings,
    } = params;

    // 构建运行配置
    const runConfig: AgentRunConfig = {
      sessionKey,
      channel: channel as AgentRunConfig['channel'],
      lane,
      model: this.options.defaultModel,
      temperature: this.options.defaultTemperature,
      maxTokens: this.options.defaultMaxTokens,
      extraSystemPrompt,
      timeoutMs: this.options.defaultTimeout,
    };

    // 创建 FollowupRun 对象
    const followupRun: FollowupRun = {
      runId: generateId(),
      prompt: commandBody,
      config: runConfig,
    };

    // 如果是心跳且没有需要处理的内容，快速返回
    if (isHeartbeat && !this.requiresAttention(commandBody)) {
      return undefined;
    }

    // 执行 Agent 步骤
    const result = await this.runAgentStep({
      sessionKey,
      message: commandBody,
      channel,
      lane,
      extraSystemPrompt,
      timeoutMs: runConfig.timeoutMs!,
    });

    return result;
  }

  /**
   * 执行单个 Agent 步骤
   */
  private async runAgentStep(params: {
    sessionKey: string;
    message: string;
    channel: string;
    lane: string;
    extraSystemPrompt: string;
    timeoutMs: number;
  }): Promise<ReplyPayload | undefined> {
    const stepId = generateId();

    try {
      // 1. 调用 Gateway 发起请求
      const response = await callGateway<{ runId?: string }>({
        method: 'agent',
        params: {
          message: params.message,
          sessionKey: params.sessionKey,
          idempotencyKey: stepId,
          deliver: false,
          channel: params.channel,
          lane: params.lane,
          extraSystemPrompt: params.extraSystemPrompt,
        },
        timeoutMs: 10000,
      });

      const runId = response?.runId ?? stepId;

      // 2. 等待 Agent 完成
      const waitMs = Math.min(params.timeoutMs, 60000);
      const waitResult = await callGateway<{ status?: string }>({
        method: 'agent.wait',
        params: {
          runId,
          timeoutMs: waitMs,
        },
        timeoutMs: waitMs + 2000,
      });

      if (waitResult?.status !== 'ok') {
        return undefined;
      }

      // 3. 读取最新回复
      const replyText = await readLatestAssistantReply({
        sessionKey: params.sessionKey,
        limit: 50,
      });

      return {
        id: stepId,
        content: replyText ?? '',
        state: AgentState.IDLE,
      };
    } catch (error) {
      console.error('Agent step error:', error);
      return {
        id: stepId,
        content: '',
        state: AgentState.ERROR,
      };
    }
  }

  /**
   * 检查是否需要处理
   */
  private requiresAttention(message: string): boolean {
    // 检查消息是否包含需要处理的标记
    const heartbeatMarker = message.toLowerCase().includes('heartbeat');
    return !heartbeatMarker;
  }

  /**
   * 处理响应构建
   */
  private buildReplyPayload(content: string, usage?: Usage): ReplyPayload {
    return {
      id: generateId(),
      content,
      state: AgentState.IDLE,
      usage,
    };
  }
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 创建 Agent 运行器
 */
export function createAgentRunner(options?: AgentRunnerOptions): AgentRunner {
  return new AgentRunner(options);
}
