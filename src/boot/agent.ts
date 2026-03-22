/**
 * Agent Boot Integration
 *
 * 将 Boot 机制集成到 Agent 启动流程
 */

import { runBoot, buildBootPrompt, type BootResult } from './index.js';
import { createAgentLoop, type AgentLoop, type AgentLoopConfig } from '../agents/loop.js';
import type { Message } from '../agents/types.js';

/**
 * Agent Boot 配置
 */
export interface AgentBootConfig {
  /** 工作区目录 */
  workspaceDir: string;
  /** Agent 配置 */
  agentConfig?: Partial<AgentLoopConfig>;
  /** 是否启用 boot */
  enableBoot?: boolean;
  /** boot 超时时间 (ms) */
  bootTimeoutMs?: number;
  /** 启动完成回调 */
  onBootComplete?: (result: BootResult) => void;
  /** 启动失败回调 */
  onBootError?: (error: Error) => void;
}

/**
 * 运行 Agent 并执行 Boot 序列
 */
export async function runAgentWithBoot(
  config: AgentBootConfig,
  initialMessage?: string
): Promise<{
  agent: AgentLoop;
  bootResult: BootResult | null;
}> {
  const {
    workspaceDir,
    agentConfig = {},
    enableBoot = true,
    bootTimeoutMs = 60000,
    onBootComplete,
    onBootError,
  } = config;

  let bootResult: BootResult | null = null;

  // 如果启用 boot，执行 boot 序列
  if (enableBoot) {
    try {
      bootResult = await runBoot(workspaceDir, {
        onMessage: async (target, content) => {
          console.log(`[Boot] Sending message to ${target}: ${content}`);
          // 这里可以发送消息到指定目标
        },
        onRun: async (command) => {
          console.log(`[Boot] Running command: ${command}`);
          // 执行 shell 命令
          const { exec } = await import('child_process');
          return new Promise((resolve, reject) => {
            exec(command, { cwd: workspaceDir }, (error, stdout, stderr) => {
              if (error) {
                reject(error);
              } else {
                resolve(undefined);
              }
            });
          });
        },
        onTask: async (task) => {
          console.log(`[Boot] Creating task: ${task}`);
          // 可以集成任务系统创建任务
        },
      });

      if (onBootComplete) {
        onBootComplete(bootResult);
      }

      console.log(`[Boot] Completed with status: ${bootResult.status}`);
    } catch (error) {
      const bootError = error instanceof Error ? error : new Error(String(error));
      console.error('[Boot] Failed:', bootError);

      if (onBootError) {
        onBootError(bootError);
      }

      // Boot 失败是否继续取决于配置
      // 这里选择继续，因为 boot 是可选的
    }
  }

  // 创建 Agent Loop
  const agent = createAgentLoop(agentConfig);

  // 如果有 boot 指令需要执行，可以将其作为初始消息
  if (bootResult?.status === 'ran' && bootResult.commands) {
    // 可以将 boot 指令作为系统提示的一部分
    const bootPrompt = `## Startup Tasks\nThe following tasks were completed during boot:\n${
      bootResult.commands.map(c => `- ${c}`).join('\n')
    }`;

    // 合并到 extraSystemPrompt
    agentConfig.extraSystemPrompt = [
      agentConfig.extraSystemPrompt || '',
      bootPrompt,
    ].filter(Boolean).join('\n\n');
  }

  return { agent, bootResult };
}

/**
 * 创建带 Boot 的 Agent 运行时
 */
export class AgentRuntime {
  private agent: AgentLoop | null = null;
  private config: AgentBootConfig;
  private initialized: boolean = false;

  constructor(config: AgentBootConfig) {
    this.config = config;
  }

  /**
   * 初始化 Agent
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const { agent, bootResult } = await runAgentWithBoot(this.config);

    this.agent = agent;
    this.initialized = true;

    console.log('[AgentRuntime] Initialized', {
      bootStatus: bootResult?.status,
    });
  }

  /**
   * 运行 Agent
   */
  async run(params: {
    message: string;
    history?: Message[];
  }): Promise<unknown> {
    if (!this.agent) {
      await this.initialize();
    }

    return this.agent!.run(params);
  }

  /**
   * 停止 Agent
   */
  async stop(): Promise<void> {
    // 可以在这里添加清理逻辑
    this.agent = null;
    this.initialized = false;
  }

  /**
   * 获取 Agent 实例
   */
  getAgent(): AgentLoop | null {
    return this.agent;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * 创建 Agent 运行时
 */
export function createAgentRuntime(config: AgentBootConfig): AgentRuntime {
  return new AgentRuntime(config);
}
