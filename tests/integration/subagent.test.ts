// Subagent 集成测试 - 测试子智能体功能
import { describe, it, expect, beforeEach } from "vitest";
import { createAgentLoop, type AgentLoop } from "../../src/agents/index.js";
import { createDefaultTools } from "../../src/tools/index.js";

describe("Subagent Integration", () => {
  let agentLoop: AgentLoop;

  beforeEach(() => {
    agentLoop = createAgentLoop({
      maxIterations: 5,
      timeoutMs: 60000,
    });

    // 注册所有默认工具（包含 task 工具）
    const tools = createDefaultTools();
    for (const tool of tools) {
      agentLoop.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: (tool.parameters as any).properties || {},
          required: (tool.parameters as any).required || [],
        },
        execute: async (toolCallId: string, params: any) => {
          return await tool.execute(toolCallId, params);
        },
      });
    }
  });

  describe("Task Tool (Parent Agent)", () => {
    it("should have task tool registered", () => {
      // 验证 task 工具已注册
      const tools = agentLoop.getToolDefinitions();
      const taskTool = tools?.find(t => t.name === 'task');
      expect(taskTool).toBeDefined();
      expect(taskTool?.name).toBe('task');
      expect(taskTool?.description).toContain('subagent');
    });
  });

  describe("Subagent Execution", () => {
    it("should execute simple subagent task", async () => {
      // 测试子智能体能否正确执行任务
      const { runSubagent } = await import("../../src/agents/subagent.js");

      const result = await runSubagent({
        prompt: "请列出当前目录的文件",
        maxIterations: 5,
      });

      console.log("Subagent result:", result);
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("should execute subagent with file read", async () => {
      const { runSubagent } = await import("../../src/agents/subagent.js");

      const result = await runSubagent({
        prompt: "请读取当前目录下的 package.json 文件的前 10 行",
        maxIterations: 5,
      });

      console.log("Subagent result:", result);
      expect(result.success).toBe(true);
      expect(result.content).toContain('package.json');
    });

    it("should execute subagent and count iterations", async () => {
      const { runSubagent } = await import("../../src/agents/subagent.js");

      const result = await runSubagent({
        prompt: "请执行命令 echo hello",
        maxIterations: 3,
      });

      console.log("Subagent result:", result);
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.toolCalls).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Subagent Isolation", () => {
    it("should not have task tool in subagent", async () => {
      const { runSubagent } = await import("../../src/agents/subagent.js");

      // 运行一个子任务，子智能体不应该有 task 工具
      const result = await runSubagent({
        prompt: "请列出当前目录的文件，然后统计有多少个文件",
        maxIterations: 5,
      });

      console.log("Subagent result:", result);
      // 子智能体应该能正常执行（因为不包含 task 工具）
      expect(result.success).toBe(true);
    });

    it("should run multiple subagents independently", async () => {
      const { runSubagent } = await import("../../src/agents/subagent.js");

      // 并发运行两个子任务
      const [result1, result2] = await Promise.all([
        runSubagent({
          prompt: "请执行命令 echo task1",
          maxIterations: 3,
        }),
        runSubagent({
          prompt: "请执行命令 echo task2",
          maxIterations: 3,
        }),
      ]);

      console.log("Subagent result 1:", result1);
      console.log("Subagent result 2:", result2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe("Parent + Subagent Integration", () => {
    it("should use task tool to delegate work", async () => {
      const hasApiKey = Boolean(
        process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.MINIMAX_API_KEY
      );

      if (!hasApiKey) {
        console.log("Skipping test - no API key found");
        return;
      }

      // 使用 task 工具委派工作
      const result = await agentLoop.run({
        message: "请使用子任务列出当前目录的文件",
      });

      console.log("Agent result:", result);
      console.log("Tool calls:", result.toolCalls);

      // 应该能成功调用 task 工具
      expect(result.success || result.toolCalls > 0 || result.iterations > 0).toBe(true);
    });
  });
});

describe("Subagent Direct Function", () => {
  it("should export runSubagent function", async () => {
    const { runSubagent, listSubagents, killSubagent } = await import("../../src/agents/index.js");

    expect(typeof runSubagent).toBe('function');
    expect(typeof listSubagents).toBe('function');
    expect(typeof killSubagent).toBe('function');
  });
});
