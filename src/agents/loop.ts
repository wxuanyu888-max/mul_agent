/**
 * Agent 循环模块
 *
 * 实现 LLM + Tools 的完整 Agent 循环：
 * 1. 使用 PromptBuilder 构建系统提示词
 * 2. LLM 生成回复 + 工具调用
 * 3. 执行工具
 * 4. 将结果加入上下文
 * 5. 循环直到完成
 *
 * 压缩策略（三层）：
 * 1. micro_compact: 每次 LLM 调用前，将旧的 tool result 替换为占位符
 * 2. auto_compact: token 超过阈值时，保存完整对话到磁盘，让 LLM 做摘要
 * 3. manual compact: 手动调用 compact 工具触发同样的摘要机制
 */

import { getLLMClient, type LLMMessage, type LLMRequest, type LLMResponse } from './llm.js';
import { buildSystemPrompt, type BuildContext, type ToolInfo, type SkillInfo } from './prompt/index.js';
import { createDefaultTools, createLoadTool, syncWorkspaceToMemory } from '../tools/index.js';
import type { Message, ToolResult as AgentToolResult, LoadedItem, LLMMessage as AILoopLLMMessage } from './types.js';
import { toLLMMessages } from './types.js';
import { errorResult, type JsonToolResult, type ToolResult } from '../tools/types.js';
import {
  microCompact,
  autoCompact,
  manualCompact,
  needsAutoCompact,
  estimateMessageTokens,
  createCompactionContext,
  type CompactionContext,
  type CompactionConfig,
} from './compaction.js';
import { getBackgroundManager, type BackgroundNotification } from './background.js';
import { loadSkillsFromDir, getUserInvocableSkills, type SkillEntry } from '../skills/index.js';
import { getEnabledSkills } from '../skills/manager.js';
import path from 'node:path';

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Agent 循环配置
 */
export interface AgentLoopConfig {
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 超时时间 (ms) */
  timeoutMs?: number;
  /** 工作目录 */
  workspaceDir?: string;
  /** Session ID（用于工作区划分） */
  sessionId?: string;
  /** 文件列表刷新间隔（轮数），默认10轮 */
  fileRefreshInterval?: number;
  /** 额外系统提示 */
  extraSystemPrompt?: string;
  /** 提示模式 */
  promptMode?: 'full' | 'minimal' | 'none';
  /** 工具确认回调 */
  onToolConfirm?: (tool: ToolCall) => Promise<boolean>;
  /** 工具执行回调 */
  onToolExecute?: (tool: ToolCall, result: AgentToolResult) => void;
  /** LLM 调用前回调 */
  onLlmCall?: (messages: LLMRequest['messages'], systemPrompt: string) => void;
  /** LLM 响应后回调 */
  onLlmResponse?: (response: LLMResponse) => void;
  /** 压缩配置 */
  compaction?: CompactionConfig;
  /** 手动触发压缩的回调 */
  onManualCompact?: (messages: any[]) => Promise<void>;
}

/**
 * Agent 循环结果
 */
export interface AgentLoopResult {
  /** 最终回复内容 */
  content: string;
  /** 是否成功 */
  success: boolean;
  /** 迭代次数 */
  iterations: number;
  /** 工具调用次数 */
  toolCalls: number;
  /** 错误信息 */
  error?: string;
  /** 使用统计 */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** 完整的消息历史（包含 tool_calls 和 tool_results） */
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    tool_calls?: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;
    tool_call_id?: string;
    name?: string;
  }>;
}

/**
 * 注册的工具
 */
interface RegisteredTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation?: boolean;
}

/**
 * Agent 循环类
 */
export class AgentLoop {
  private tools: Map<string, RegisteredTool> = new Map();
  private config: Required<AgentLoopConfig>;
  private compactionContext: CompactionContext;
  /** 追踪当前会话生成的文件 */
  private generatedFiles: Array<{ path: string; name: string; timestamp: number }> = [];
  /** 已加载的 skill/MCP */
  private loadedItems: Map<string, LoadedItem> = new Map();
  /** 对话轮次计数 */
  private conversationRound: number = 0;
  /** 审查触发阈值 */
  private readonly REVIEW_THRESHOLD = 10;

  constructor(config: AgentLoopConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations ?? 20,
      timeoutMs: config.timeoutMs ?? 300000,
      workspaceDir: config.workspaceDir ?? process.cwd(),
      sessionId: config.sessionId ?? '',
      fileRefreshInterval: config.fileRefreshInterval ?? 10,
      extraSystemPrompt: config.extraSystemPrompt ?? '',
      promptMode: config.promptMode ?? 'full',
      onToolConfirm: config.onToolConfirm ?? (async () => true),
      onToolExecute: config.onToolExecute ?? (() => {}),
      onLlmCall: config.onLlmCall ?? (() => {}),
      onLlmResponse: config.onLlmResponse ?? (() => {}),
      compaction: config.compaction ?? {},
      onManualCompact: config.onManualCompact ?? (async () => {}),
    };
    this.compactionContext = createCompactionContext();
  }

  /**
   * 注册工具
   */
  registerTool(tool: RegisteredTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: RegisteredTool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * 注册默认工具集
   */
  registerDefaultTools(): void {
    const defaultTools = createDefaultTools({ sessionId: this.config.sessionId });
    this.registerTools(defaultTools as unknown as RegisteredTool[]);

    // 注册 load 工具
    const loadTool = createLoadTool({
      getLoadedItems: () => this.loadedItems,
      setLoadedItem: (name: string, item: LoadedItem) => {
        this.loadedItems.set(name, item);
      }
    });
    this.registerTool(loadTool as unknown as RegisteredTool);
  }

  /**
   * 获取已加载的 skill/MCP
   */
  getLoadedItems(): LoadedItem[] {
    return Array.from(this.loadedItems.values());
  }

  /**
   * 获取当前对话轮次
   */
  getConversationRound(): number {
    return this.conversationRound;
  }

  /**
   * 追踪工具生成的文件
   */
  private trackGeneratedFiles(toolName: string, output: string): void {
    // 只追踪已知会产生文件的工具
    const fileTools = ['video', 'web_fetch', 'webfetch'];
    if (!fileTools.includes(toolName)) return;

    try {
      // 尝试从输出中提取 JSON 数据
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;

      const data = JSON.parse(jsonMatch[0]);
      const files = data.files || [];

      for (const file of files) {
        if (file.path) {
          // 避免重复添加
          const exists = this.generatedFiles.some(f => f.path === file.path);
          if (!exists) {
            this.generatedFiles.push({
              path: file.path,
              name: file.name || file.path.split('/').pop(),
              timestamp: Date.now(),
            });
          }
        }
      }

      // 保留最近 20 个文件
      if (this.generatedFiles.length > 20) {
        this.generatedFiles = this.generatedFiles.slice(-20);
      }
    } catch {
      // 解析失败，忽略
    }
  }

  /**
   * s08: 注入后台任务通知
   * 每次 LLM 调用前排空通知队列，将结果注入消息
   */
  private injectBackgroundNotifications(messages: Message[]): Message[] {
    const bg = getBackgroundManager();
    const notifications = bg.drainNotifications();

    if (notifications.length === 0) {
      return messages;
    }

    console.log(`[Background] Injecting ${notifications.length} completed task(s)`);

    // 构建通知文本
    const notifText = notifications
      .map((n) => {
        const statusIcon = n.status === 'completed' ? '✓' : n.status === 'timeout' ? '⏱' : '✗';
        return `[bg:${n.taskId}] ${statusIcon} ${n.status}\nOutput: ${n.output.substring(0, 2000)}${n.output.length > 2000 ? '...' : ''}${n.error ? `\nError: ${n.error}` : ''}`;
      })
      .join('\n\n');

    // 注入到消息中
    const injection: LLMRequest['messages'] = [
      {
        role: 'user',
        content: `<background-results>\n${notifText}\n</background-results>`,
      },
      {
        role: 'assistant',
        content: 'Noted background results.',
      },
    ];

    return [...messages, ...injection];
  }

  /**
   * 构建系统提示词（复用 PromptBuilder）
   */
  private async buildPrompt(): Promise<string> {
    // 将工具转换为 ToolInfo 格式
    const toolInfos: ToolInfo[] = [];
    for (const [name, tool] of this.tools) {
      toolInfos.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters.properties || {},
      });
    }

    // 加载 skills
    const skills = await this.loadSkills();

    // 检查是否是审查轮次
    const isReviewRound = this.conversationRound > 0 && this.conversationRound % this.REVIEW_THRESHOLD === 0;

    // 将 loadedItems 转换为数组
    const loadedItemsArray = Array.from(this.loadedItems.values());

    // 构建上下文
    const context: BuildContext = {
      config: {
        workspaceDir: this.config.workspaceDir,
        sessionId: this.config.sessionId,
        generatedFiles: this.generatedFiles,
        extraSystemPrompt: this.config.extraSystemPrompt,
        promptMode: this.config.promptMode,
      },
      tools: toolInfos,
      skills: skills,
      loadedItems: loadedItemsArray,
      isReviewRound: isReviewRound,
    };

    // 使用提示词 builder 构建系统提示词
    return buildSystemPrompt(context);
  }

  /**
   * 加载 skills - 支持分布式加载，默认只显示 name, description, location
   * 根据 manager.ts 配置过滤只显示启用的 skills
   */
  private async loadSkills(): Promise<SkillInfo[]> {
    const skillsDir = path.join(process.cwd(), 'skills');
    try {
      // 递归加载 skills/*/SKILL.md 文件
      const skillEntries = await loadSkillsFromDir(skillsDir);
      const userSkills = getUserInvocableSkills(skillEntries);

      // 获取启用的 skills 列表
      const enabledSkills = getEnabledSkills();

      // 过滤只显示启用的 skills
      const filteredSkills = userSkills.filter((entry: SkillEntry) =>
        enabledSkills.includes(entry.skill.name)
      );

      return filteredSkills.map((entry: SkillEntry) => ({
        id: entry.skill.name,
        name: entry.skill.name,
        description: entry.skill.description || '',
        location: `skills/${entry.skill.name}/SKILL.md`,
      }));
    } catch (error) {
      console.error('Failed to load skills:', error);
      return [];
    }
  }

  /**
   * 运行 Agent 循环
   */
  async run(params: {
    message: string;
    history?: Message[];
  }): Promise<AgentLoopResult> {
    const { message, history = [] } = params;

    // 递增对话轮次
    this.conversationRound++;

    // 重置压缩上下文
    this.compactionContext = createCompactionContext();

    // 构建系统提示词（使用 PromptBuilder）
    let systemPrompt = await this.buildPrompt();
    let lastFileCount = this.generatedFiles.length;  // 追踪文件数量变化

    // 构建初始消息
    let messages: Message[] = [];

    // 添加历史消息（只包含 user 和 assistant，排除 system）
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const formatted = {
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        } as const;

        // 添加 tool_calls (assistant 角色)
        if (msg.toolCalls) {
          (formatted as any).tool_calls = msg.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            input: tc.input,
          }));
        }

        messages.push(formatted);
      }
      // system 消息通过 systemPrompt 处理，不加到 messages 数组
    }

    // 添加当前消息
    messages.push({
      role: 'user',
      content: message,
    });

    const llm = getLLMClient();
    let iterations = 0;
    let toolCallsCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const compactionConfig = this.config.compaction;

    try {
      // Agent 循环
      while (iterations < this.config.maxIterations) {
        iterations++;

        // === 文件列表刷新检查 ===
        // 每 N 轮或文件数量变化时重新构建 systemPrompt
        const needsRefresh =
          iterations % this.config.fileRefreshInterval === 0 ||
          this.generatedFiles.length !== lastFileCount;

        if (needsRefresh) {
          console.log(`[FileRefresh] Refreshing file list (iteration: ${iterations}, files: ${this.generatedFiles.length})`);
          systemPrompt = await this.buildPrompt();
          lastFileCount = this.generatedFiles.length;
        }

        // === Layer 1: micro_compact ===
        // 每次 LLM 调用前，将旧的 tool result 替换为占位符
        if (compactionConfig) {
          const compactResult = microCompact(messages, compactionConfig, this.compactionContext);
          messages = compactResult.messages;
          this.compactionContext = compactResult.context;
        }

        // === Check: 是否需要 auto_compact ===
        if (compactionConfig && needsAutoCompact(messages, compactionConfig.autoCompactThreshold ?? 50000)) {
          console.log(`[Compaction] Token count ${estimateMessageTokens(messages)} exceeds threshold, performing auto_compact...`);

          // === Layer 2: auto_compact ===
          const autoCompactResult = await autoCompact(messages, compactionConfig, this.compactionContext);
          messages = autoCompactResult.messages;
          this.compactionContext = autoCompactResult.context;

          console.log(`[Compaction] Auto-compact completed. Messages reduced from ${autoCompactResult.messages.length} to ${messages.length}`);
        }

        // === s08: 注入后台任务通知 ===
        // 每次 LLM 调用前排空通知队列
        messages = this.injectBackgroundNotifications(messages);

        // 获取工具定义
        const tools = this.getToolDefinitions();

        // 调用 LLM
        this.config.onLlmCall(messages, systemPrompt);

        const response = await llm.chat({
          model: (llm as any).model,
          messages: toLLMMessages(messages),
          system: systemPrompt,
          tools: tools && tools.length > 0 ? tools : undefined,
        });

        this.config.onLlmResponse(response);

        // 统计 token
        totalInputTokens += response.usage?.input_tokens || 0;
        totalOutputTokens += response.usage?.output_tokens || 0;

        // 提取文本内容
        const textContent = this.extractTextContent(response);

        // 检查停止原因
        const stopReason = response.stop_reason;

        if (stopReason === 'tool_use') {
          // 需要调用工具
          const toolCalls = this.extractToolCalls(response);

          if (toolCalls.length === 0) {
            return {
              content: textContent || 'Tool use indicated but no tool calls found',
              success: true,
              iterations,
              toolCalls: toolCallsCount,
              usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
            };
          }

          // 执行工具调用
          // 一次性添加所有的 tool_calls 到消息中
          messages.push({
            role: 'assistant',
            content: JSON.stringify({ tool_calls: toolCalls }),
          });

          // 执行所有工具
          for (const toolCall of toolCalls) {
            toolCallsCount++;

            // === Layer 3: 手动压缩检查 ===
            // 检查是否是 compact 工具调用
            if (toolCall.name === 'compact') {
              console.log('[Compaction] Manual compact triggered by tool call');

              // 执行手动压缩
              const manualResult = await manualCompact(messages, compactionConfig, this.compactionContext);
              messages = manualResult.messages;
              this.compactionContext = manualResult.context;

              // 通知回调
              await this.config.onManualCompact(messages);

              // 添加确认消息
              messages.push({
                role: 'user',
                content: 'Conversation has been compacted. Previous context has been summarized.',
              });

              continue;
            }

            // 检查是否需要确认
            const confirmed = await this.config.onToolConfirm(toolCall);
            if (!confirmed) {
              messages.push({
                role: 'user',
                content: 'Tool execution was rejected by user',
                tool_call_id: toolCall.id,
              });
              continue;
            }

            // 执行工具
            const result = await this.executeTool(toolCall);

            // 提取并追踪生成的文件路径
            this.trackGeneratedFiles(toolCall.name, result.output);

            this.config.onToolExecute(toolCall, result);

            // 将工具结果加入消息（Anthropic 兼容格式）
            messages.push({
              role: 'user',
              content: result.output,
              tool_call_id: toolCall.id,
            });
          }

          // 继续循环
          continue;
        }

        // 其他停止原因，返回文本内容
        // 添加最终的 assistant 消息到 messages
        messages.push({
          role: 'assistant',
          content: textContent,
        });

        // 如果没有文本内容，根据工具调用次数生成默认回复
        const finalContent = textContent || (toolCallsCount > 0
          ? `Task completed successfully with ${toolCallsCount} tool call(s).`
          : 'Task completed with no output.');

        return {
          content: finalContent,
          success: true,
          iterations,
          toolCalls: toolCallsCount,
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
          messages: messages as AgentLoopResult['messages'],
        };
      }

      // 达到最大迭代次数
      return {
        content: 'Max iterations reached',
        success: false,
        iterations,
        toolCalls: toolCallsCount,
        error: 'Max iterations reached',
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        messages: messages as AgentLoopResult['messages'],
      };
    } catch (error) {
      return {
        content: '',
        success: false,
        iterations,
        toolCalls: toolCallsCount,
        error: error instanceof Error ? error.message : String(error),
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        messages: messages as AgentLoopResult['messages'],
      };
    }
  }

  /**
   * 手动触发压缩
   */
  async triggerCompact(): Promise<void> {
    // 这是一个外部调用压缩的方法
    // 在实际使用中，消息需要从外部传入
    console.log('[Compaction] Manual compact triggered externally');
  }

  /**
   * 获取工具定义（用于 LLM）
   */
  private getToolDefinitions(): LLMRequest['tools'] {
    const tools: LLMRequest['tools'] = [];

    for (const [name, tool] of this.tools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters.properties || {},
      });
    }

    return tools;
  }

  /**
   * 提取文本内容
   */
  private extractTextContent(response: LLMResponse): string {
    const textBlocks = response.content.filter((block) => block.type === 'text');
    return textBlocks.map((block) => block.text || '').join('\n');
  }

  /**
   * 提取工具调用
   */
  private extractToolCalls(response: LLMResponse): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const responseAny = response as any;

    // 方式1: 从 response.tool_calls 解析（标准 Anthropic 格式）
    if (responseAny.tool_calls) {
      for (const tc of responseAny.tool_calls) {
        toolCalls.push({
          id: tc.id || `tool_${Date.now()}`,
          name: tc.name || '',
          input: tc.input || {},
        });
      }
    }

    // 方式2: 从 response.content 数组中解析（MiniMax 兼容格式）
    // MiniMax 返回的格式: { type: 'tool_use', id: '...', name: '...', input: {...} }
    if (response.content && Array.isArray(response.content)) {
      for (const block of response.content) {
        const blockAny = block as any;
        if (block && typeof block === 'object' && blockAny.type === 'tool_use') {
          // 避免重复添加
          if (!toolCalls.find(tc => tc.id === blockAny.id)) {
            toolCalls.push({
              id: blockAny.id || `tool_${Date.now()}`,
              name: blockAny.name || '',
              input: blockAny.input || {},
            });
          }
        }
      }
    }

    return toolCalls;
  }

  /**
   * 执行工具
   */
  private async executeTool(toolCall: ToolCall): Promise<AgentToolResult> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        output: JSON.stringify({ error: `Tool not found: ${toolCall.name}` }),
        isError: true,
      };
    }

    try {
      const result: JsonToolResult = await tool.execute(toolCall.id, toolCall.input);
      return {
        toolCallId: toolCall.id,
        output: result.content,
        isError: !!result.error,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        output: JSON.stringify({ error: String(error) }),
        isError: true,
      };
    }
  }
}

/**
 * 创建 Agent 循环
 */
export function createAgentLoop(config?: AgentLoopConfig): AgentLoop {
  return new AgentLoop(config);
}

/**
 * 便捷函数：运行单次 Agent
 */
export async function runAgent(params: {
  message: string;
  history?: Message[];
  maxIterations?: number;
  workspaceDir?: string;
  extraSystemPrompt?: string;
  promptMode?: 'full' | 'minimal' | 'none';
}): Promise<AgentLoopResult> {
  const loop = new AgentLoop({
    maxIterations: params.maxIterations,
    workspaceDir: params.workspaceDir,
    extraSystemPrompt: params.extraSystemPrompt,
    promptMode: params.promptMode,
  });

  // 启动时同步工作区到向量库
  syncWorkspaceToMemory().catch(console.error);

  loop.registerDefaultTools();

  return loop.run({
    message: params.message,
    history: params.history,
  });
}
