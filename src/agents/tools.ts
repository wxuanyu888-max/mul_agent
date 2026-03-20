/**
 * 工具循环模块
 *
 * 负责 Agent 与工具之间的交互循环
 */

import type { Tool, ToolCall, ToolResult, ToolGate } from './types.js';

/**
 * 工具执行器接口
 */
export interface ToolExecutor {
  execute(toolCall: ToolCall): Promise<ToolResult>;
}

/**
 * 工具注册表
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /**
   * 注册工具
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 列出所有工具
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}

/**
 * 工具循环配置
 */
export interface ToolLoopConfig {
  maxIterations?: number;
  timeoutMs?: number;
  executor: ToolExecutor;
}

/**
 * 工具循环结果
 */
export interface ToolLoopResult {
  iterations: number;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  finalReply?: string;
  success: boolean;
  error?: string;
}

/**
 * 工具循环
 *
 * 负责执行 Agent 决定调用的工具，并收集结果
 */
export class ToolLoop {
  private registry: ToolRegistry;
  private config: Required<ToolLoopConfig>;

  constructor(registry: ToolRegistry, config: ToolLoopConfig) {
    this.registry = registry;
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      timeoutMs: config.timeoutMs ?? 300000,
      executor: config.executor,
    };
  }

  /**
   * 执行工具调用列表
   */
  async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      // 检查工具是否存在
      const tool = this.registry.get(toolCall.name);
      if (!tool) {
        results.push({
          toolCallId: toolCall.id,
          output: `Tool not found: ${toolCall.name}`,
          isError: true,
        });
        continue;
      }

      // 检查工具门条件
      if (!this.checkToolGate(tool.gate)) {
        results.push({
          toolCallId: toolCall.id,
          output: `Tool ${tool.name} is not available`,
          isError: true,
        });
        continue;
      }

      try {
        const result = await this.config.executor.execute(toolCall);
        results.push(result);
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          output: error instanceof Error ? error.message : String(error),
          isError: true,
        });
      }
    }

    return results;
  }

  /**
   * 检查工具门条件
   */
  private checkToolGate(gate?: ToolGate): boolean {
    if (!gate) {
      return true;
    }

    // 总是可用
    if (gate.always) {
      return true;
    }

    // 检查操作系统
    if (gate.os && gate.os.length > 0) {
      const currentOs = process.platform;
      if (!gate.os.includes(currentOs)) {
        return false;
      }
    }

    // 检查必需的命令
    if (gate.bins && gate.bins.length > 0) {
      // 这里简化处理，实际需要检查命令是否存在
      for (const bin of gate.bins) {
        if (!this.commandExists(bin)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 检查命令是否存在
   */
  private commandExists(_command: string): boolean {
    // 简化实现，实际应该检查 PATH
    const path = process.env.PATH ?? '';
    const commands = path.split(':');
    return commands.some(p => p.length > 0);
  }
}

/**
 * 工具执行结果
 */
export interface ExecuteToolResult {
  output: string;
  isError?: boolean;
}

/**
 * Bash 工具执行器
 */
export class BashToolExecutor implements ToolExecutor {
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const command = toolCall.input.command as string;

    try {
      // 使用 Node.js 子进程执行
      const { execSync } = await import('node:child_process');

      const output = execSync(command, {
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return {
        toolCallId: toolCall.id,
        output: output as string,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        output: error instanceof Error ? error.message : String(error),
        isError: true,
      };
    }
  }
}

/**
 * 创建默认工具注册表
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // 注册内置工具
  registry.register({
    name: 'bash',
    description: '执行 bash 命令',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
      },
      required: ['command'],
    },
    requiresConfirmation: true,
  });

  registry.register({
    name: 'read',
    description: '读取文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
      },
      required: ['path'],
    },
  });

  registry.register({
    name: 'write',
    description: '写入文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '文件内容' },
      },
      required: ['path', 'content'],
    },
    requiresConfirmation: true,
  });

  registry.register({
    name: 'edit',
    description: '编辑文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        oldString: { type: 'string', description: '要替换的内容' },
        newString: { type: 'string', description: '替换后的内容' },
      },
      required: ['path', 'oldString', 'newString'],
    },
    requiresConfirmation: true,
  });

  registry.register({
    name: 'search',
    description: '搜索文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        path: { type: 'string', description: '搜索路径' },
      },
      required: ['query'],
    },
  });

  return registry;
}
