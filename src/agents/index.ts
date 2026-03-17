/**
 * OpenClaw Agent 执行流程模块
 *
 * 提供完整的 Agent 执行能力：
 * - 会话管理
 * - Agent 运行
 * - 工具循环
 * - 心跳机制
 */

// 类型导出
export * from './types.js';

// 模块导出
export { SessionManager, InMemorySessionStore, createSessionManager } from './session.js';
export type { SessionStore } from './session.js';

export { AgentRunner, createAgentRunner } from './runner.js';
export type { AgentRunnerOptions } from './runner.js';

export { runAgentStep, readLatestAssistantReply, stripToolMessages } from './step.js';
export type { AgentStepParams, AgentStepResult } from './step.js';

export {
  ToolRegistry,
  ToolLoop,
  BashToolExecutor,
  createDefaultToolRegistry,
} from './tools.js';
export type { ToolExecutor, ToolLoopConfig, ToolLoopResult } from './tools.js';

export {
  Heartbeat,
  createHeartbeat,
  parseHeartbeatResponse,
  HEARTBEAT_OK,
} from './heartbeat.js';
export type { HeartbeatConfig, HeartbeatResult } from './heartbeat.js';

export {
  GatewayClient,
  getGlobalGateway,
  setGlobalGateway,
  callGateway,
  createGateway,
} from './gateway.js';
export type { GatewayConfig } from './gateway.js';

// 提示词构建
export { buildSystemPrompt, buildHeartbeatPrompt } from './prompt/builder.js';
export * from './prompt/types.js';

// 上下文压缩
export {
  compactMessages,
  estimateMessageTokens,
  needsCompaction,
} from './compaction.js';
export type { CompactionConfig } from './compaction.js';

// 配置加载
export {
  loadConfig,
  getApiKey,
  getBaseUrl,
  getDefaultModel,
  getFallbackModels,
  getTemperature,
  getMaxTokens,
  getProvider,
  reloadConfig,
  validateConfig,
} from './config.js';
export type { AgentConfig } from './config.js';

// LLM 客户端
export { LLMClient, getLLMClient, chat, chatWithContext } from './llm.js';
export type { LLMRequest, LLMResponse } from './llm.js';

// 重试机制
export {
  withRetry,
  createRetryableFn,
  createRetryState,
  DEFAULT_RETRY_CONFIG,
} from './retry.js';
export type { RetryConfig, RetryOptions, RetryState } from './retry.js';

// WebSocket
export {
  createWSClient,
  EventEmitter,
  createAgentEventEmitter,
} from './websocket.js';
export type {
  WSMessage,
  WSMessageType,
  WSConnectionState,
  WSClientConfig,
  WSEventHandlers,
  AgentEvent,
  AgentEventType,
} from './websocket.js';

/**
 * 使用示例
 *
 * ```typescript
 * import {
 *   createAgentRunner,
 *   createHeartbeat,
 *   createDefaultToolRegistry,
 *   AgentRunner,
 * } from './agents';
 *
 * // 1. 创建 Agent 运行器
 * const runner = createAgentRunner({
 *   defaultModel: 'claude-sonnet-4-20250514',
 *   defaultTemperature: 0.7,
 * });
 *
 * // 2. 运行 Agent 处理消息
 * const result = await runner.run({
 *   commandBody: '请帮我写一个 hello world 程序',
 *   sessionKey: 'user-123-session',
 *   channel: 'web',
 * });
 *
 * // 3. 配置心跳
 * const heartbeat = createHeartbeat({
 *   intervalMs: 60000,
 * });
 *
 * heartbeat.start((result) => {
 *   if (result.needsAttention) {
 *     console.log('需要处理:', result.message);
 *   }
 * });
 *
 * // 4. 工具注册表
 * const tools = createDefaultToolRegistry();
 * const toolList = tools.list();
 * console.log('可用工具:', toolList.map(t => t.name));
 * ```
 */

// 快捷导入
export default {
  runner: createAgentRunner,
  heartbeat: createHeartbeat,
  tools: createDefaultToolRegistry,
  gateway: createGateway,
};
