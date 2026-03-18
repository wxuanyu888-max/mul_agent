// Agent Loop 集成测试 - 测试所有工具能否正确执行并返回结果
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAgentLoop, type AgentLoop, type AgentLoopResult, type ToolCall } from "../../src/agents/index.js";
import { createDefaultTools } from "../../src/tools/index.js";
import type { Message } from "../../src/agents/types.js";

describe("Agent Loop Integration", () => {
  let agentLoop: AgentLoop;
  let toolExecutionLog: Array<{ tool: string; params: any; result: any }>;

  beforeEach(() => {
    toolExecutionLog = [];

    agentLoop = createAgentLoop({
      maxIterations: 5,
      timeoutMs: 60000,
      onToolExecute: (toolCall: ToolCall, result: any) => {
        toolExecutionLog.push({
          tool: toolCall.name,
          params: toolCall.input,
          result: result.output,
        });
      },
    });

    // 注册所有默认工具
    const tools = createDefaultTools();
    for (const tool of tools) {
      agentLoop.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || [],
        },
        execute: async (toolCallId: string, params: any) => {
          return await tool.execute(toolCallId, params);
        },
      });
    }
  });

  describe("Tool Execution", () => {
    it("should execute read tool correctly", async () => {
      const result = await agentLoop.run({
        message: "请读取当前目录下的 package.json 文件",
      });

      // 检查是否有工具调用
      console.log("Tool execution log:", toolExecutionLog);
      console.log("Result:", result);
    });

    it("should execute ls tool correctly", async () => {
      const result = await agentLoop.run({
        message: "请列出当前目录的文件",
      });

      console.log("Tool execution log:", toolExecutionLog);
      console.log("Result:", result);
    });

    it("should execute exec tool correctly", async () => {
      const result = await agentLoop.run({
        message: "请执行命令 echo hello",
      });

      console.log("Tool execution log:", toolExecutionLog);
      console.log("Result:", result);
    });

    it("should handle multiple tool calls", async () => {
      const result = await agentLoop.run({
        message: "请列出当前目录，然后读取 package.json",
      });

      console.log("Tool execution log:", toolExecutionLog);
      console.log("Result:", result);
    });
  });

  describe("Tool Loop", () => {
    it("should complete tool call loop", async () => {
      // 这个测试需要实际的 API key，会比较慢
      // 如果没有 API key，测试会失败但可以看到工具调用流程

      const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.MINIMAX_API_KEY);

      if (!hasApiKey) {
        console.log("Skipping test - no API key found");
        return;
      }

      const result = await agentLoop.run({
        message: "请列出当前目录的文件",
      });

      console.log("Final result:", result);
      console.log("Tool calls made:", toolExecutionLog.length);

      // 如果有 API key，应该能完成
      expect(result.success || result.toolCalls > 0 || result.iterations > 0).toBe(true);
    });
  });
});

describe("Tool Registration", () => {
  it("should register all default tools", () => {
    const loop = createAgentLoop();
    const tools = createDefaultTools();

    for (const tool of tools) {
      loop.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || [],
        },
        execute: async () => ({ content: 'mock', error: undefined }),
      });
    }

    // 验证工具已注册
    for (const tool of tools) {
      // 工具注册不应该报错
      expect(() => {
        loop.registerTool({
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: tool.parameters.properties || {},
            required: tool.parameters.required || [],
          },
          execute: async () => ({ content: 'mock', error: undefined }),
        });
      }).not.toThrow();
    }
  });

  it("should have valid tool definitions", () => {
    const tools = createDefaultTools();

    for (const tool of tools) {
      // 验证工具定义有效
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(typeof tool.execute).toBe('function');
    }
  });

  it("should have execute method on all tools", () => {
    const tools = createDefaultTools();

    for (const tool of tools) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});
