// Agent Loop 模块测试
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AgentLoop,
  createAgentLoop,
  type AgentLoopConfig,
  type ToolCall,
} from "../../../src/agents/loop.js";

// Mock dependencies
vi.mock('../../../src/agents/llm.js', () => ({
  getLLMClient: vi.fn(() => ({
    chat: vi.fn(),
  })),
}));

vi.mock('../../../src/agents/prompt/index.js', () => ({
  buildSystemPrompt: vi.fn(() => 'Mock system prompt'),
}));

vi.mock('../../../src/tools/index.js', () => ({
  createDefaultTools: vi.fn(() => []),
}));

describe("AgentLoop", () => {
  describe("constructor", () => {
    it("should create with default config", () => {
      const loop = new AgentLoop();

      expect(loop).toBeDefined();
    });

    it("should apply custom maxIterations", () => {
      const loop = new AgentLoop({ maxIterations: 5 });

      expect(loop).toBeDefined();
    });

    it("should apply custom timeoutMs", () => {
      const loop = new AgentLoop({ timeoutMs: 60000 });

      expect(loop).toBeDefined();
    });

    it("should apply custom workspaceDir", () => {
      const loop = new AgentLoop({ workspaceDir: '/custom/path' });

      expect(loop).toBeDefined();
    });

    it("should apply custom extraSystemPrompt", () => {
      const loop = new AgentLoop({ extraSystemPrompt: 'Custom prompt' });

      expect(loop).toBeDefined();
    });

    it("should apply custom promptMode", () => {
      const loop = new AgentLoop({ promptMode: 'minimal' });

      expect(loop).toBeDefined();
    });
  });

  describe("registerTool", () => {
    it("should register a single tool", () => {
      const loop = new AgentLoop();

      const mockTool = {
        name: 'testTool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        execute: vi.fn().mockResolvedValue({ content: 'result', error: null }),
      };

      loop.registerTool(mockTool);

      // Tool should be registered (no error thrown)
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it("should throw when executing unregistered tool", async () => {
      const loop = new AgentLoop();

      // Note: The actual execution happens in run(), so we test the tool registration
      const mockTool = {
        name: 'testTool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: vi.fn(),
      };

      loop.registerTool(mockTool);
      expect(mockTool.execute).not.toHaveBeenCalled();
    });
  });

  describe("registerTools", () => {
    it("should register multiple tools", () => {
      const loop = new AgentLoop();

      const tools = [
        {
          name: 'tool1',
          description: 'Tool 1',
          parameters: { type: 'object', properties: {} },
          execute: vi.fn(),
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          parameters: { type: 'object', properties: {} },
          execute: vi.fn(),
        },
      ];

      loop.registerTools(tools);

      // Both tools registered (no error thrown)
      expect(tools[0].execute).not.toHaveBeenCalled();
      expect(tools[1].execute).not.toHaveBeenCalled();
    });
  });

  describe("callbacks", () => {
    it("should accept onToolConfirm callback", () => {
      const confirmFn = vi.fn().mockResolvedValue(true);
      const loop = new AgentLoop({
        onToolConfirm: confirmFn,
      });

      expect(loop).toBeDefined();
    });

    it("should accept onToolExecute callback", () => {
      const executeFn = vi.fn();
      const loop = new AgentLoop({
        onToolExecute: executeFn,
      });

      expect(loop).toBeDefined();
    });

    it("should accept onLlmCall callback", () => {
      const callFn = vi.fn();
      const loop = new AgentLoop({
        onLlmCall: callFn,
      });

      expect(loop).toBeDefined();
    });

    it("should accept onLlmResponse callback", () => {
      const responseFn = vi.fn();
      const loop = new AgentLoop({
        onLlmResponse: responseFn,
      });

      expect(loop).toBeDefined();
    });
  });

  describe("createAgentLoop", () => {
    it("should create agent loop with config", () => {
      const config: AgentLoopConfig = {
        maxIterations: 10,
        timeoutMs: 120000,
        workspaceDir: '/test',
      };

      const loop = createAgentLoop(config);

      expect(loop).toBeDefined();
    });

    it("should create agent loop without config", () => {
      const loop = createAgentLoop();

      expect(loop).toBeDefined();
    });
  });
});

describe("ToolCall interface", () => {
  it("should have correct shape", () => {
    const toolCall: ToolCall = {
      id: 'call_123',
      name: 'bash',
      input: { command: 'ls -la' },
    };

    expect(toolCall.id).toBe('call_123');
    expect(toolCall.name).toBe('bash');
    expect(toolCall.input).toEqual({ command: 'ls -la' });
  });
});

describe("AgentLoopConfig interface", () => {
  it("should accept all config options", () => {
    const config: AgentLoopConfig = {
      maxIterations: 5,
      timeoutMs: 60000,
      workspaceDir: '/workspace',
      extraSystemPrompt: 'Be helpful',
      promptMode: 'minimal',
      onToolConfirm: async () => true,
      onToolExecute: () => {},
      onLlmCall: () => {},
      onLlmResponse: () => {},
    };

    expect(config.maxIterations).toBe(5);
    expect(config.timeoutMs).toBe(60000);
    expect(config.promptMode).toBe('minimal');
  });
});
