// Skill 调用器
// 处理 skill 的执行和工具调用

import {
  type Skill,
  type SkillEntry,
  type SkillInvocationResult,
  type SkillToolCall,
} from './types.js';

/**
 * 工具接口 - 不依赖外部库
 */
export interface Tool {
  label: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (toolCallId: string, params: Record<string, any>) => Promise<ToolResult>;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  content: string;
  error?: string;
}

/**
 * Skill 调用器选项
 */
export interface SkillInvokerOptions {
  tools?: Tool[];
  sessionKey?: string;
  config?: Record<string, any>;
}

/**
 * Skill 调用器
 */
export class SkillInvoker {
  private tools: Map<string, Tool>;
  private sessionKey?: string;
  private config?: Record<string, any>;

  constructor(options: SkillInvokerOptions = {}) {
    this.tools = new Map();
    this.sessionKey = options.sessionKey;
    this.config = options.config;

    if (options.tools) {
      for (const tool of options.tools) {
        this.tools.set(tool.name, tool);
      }
    }
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * 移除工具
   */
  removeTool(name: string): void {
    this.tools.delete(name);
  }

  /**
   * 调用 skill
   */
  async invoke(skillEntry: SkillEntry, args?: Record<string, any>): Promise<SkillInvocationResult> {
    const { skill } = skillEntry;

    // 检查权限
    if (!this.canInvoke(skillEntry)) {
      return {
        success: false,
        error: 'Skill invocation not allowed',
      };
    }

    try {
      // 解析 skill 内容中的命令和工具
      const parsedCommands = this.parseCommands(skill);
      const parsedTools = this.parseTools(skill);

      // 构建执行上下文
      const context = {
        skill,
        args: args || {},
        tools: this.tools,
        sessionKey: this.sessionKey,
        config: this.config,
        commands: parsedCommands,
        availableTools: Array.from(this.tools.keys()),
      };

      // 执行 skill 内容（这里只是简单返回 skill 内容作为响应）
      // 实际使用时可以根据 skill 类型执行不同的逻辑
      const output = skill.content;

      return {
        success: true,
        output,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * 检查是否可以调用 skill
   */
  canInvoke(skillEntry: SkillEntry): boolean {
    const policy = skillEntry.invocation;

    // 如果禁用模型调用，只允许用户直接调用
    if (policy?.disableModelInvocation) {
      return true;
    }

    return true;
  }

  /**
   * 执行 skill 内的工具调用
   */
  async executeToolCalls(toolCalls: SkillToolCall[]): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];

    for (const call of toolCalls) {
      const tool = this.tools.get(call.tool);

      if (!tool) {
        results.push({
          tool: call.tool,
          success: false,
          error: `Tool not found: ${call.tool}`,
        });
        continue;
      }

      try {
        const result = await tool.execute(call.tool, call.parameters);
        results.push({
          tool: call.tool,
          success: true,
          result,
        });
      } catch (error: any) {
        results.push({
          tool: call.tool,
          success: false,
          error: error.message || 'Tool execution failed',
        });
      }
    }

    return {
      success: results.every((r) => r.success),
      results,
    };
  }

  /**
   * 解析 skill 内容中的命令
   */
  private parseCommands(skill: Skill): { name: string; description: string; prompt: string }[] {
    const commands: { name: string; description: string; prompt: string }[] = [];

    // 从 frontmatter 中解析命令
    if (skill.frontmatter?.commands) {
      const cmds = skill.frontmatter.commands;
      if (Array.isArray(cmds)) {
        for (const cmd of cmds) {
          if (typeof cmd === 'string') {
            commands.push({
              name: cmd,
              description: '',
              prompt: cmd,
            });
          } else if (cmd.name) {
            commands.push({
              name: cmd.name,
              description: cmd.description || '',
              prompt: cmd.prompt || cmd.name,
            });
          }
        }
      }
    }

    return commands;
  }

  /**
   * 解析 skill 内容中的工具
   */
  private parseTools(skill: Skill): { name: string; description: string }[] {
    const tools: { name: string; description: string }[] = [];

    if (skill.frontmatter?.tools) {
      const t = skill.frontmatter.tools;
      if (Array.isArray(t)) {
        for (const tool of t) {
          if (typeof tool === 'string') {
            tools.push({
              name: tool,
              description: '',
            });
          } else if (tool.name) {
            tools.push({
              name: tool.name,
              description: tool.description || '',
            });
          }
        }
      }
    }

    return tools;
  }
}

/**
 * 创建默认的 SkillInvoker
 */
export function createSkillInvoker(options?: SkillInvokerOptions): SkillInvoker {
  return new SkillInvoker(options);
}
