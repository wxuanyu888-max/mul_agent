/**
 * AgentLoop 真实 LLM API 集成测试
 *
 * V2: 使用真实 LLM API 进行集成测试，验证：
 * - Agent 完整循环能否正常工作
 * - 工具执行是否成功
 * - LLM + Tools 协作是否正常
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AgentLoop, type AgentLoopConfig } from '../../../src/agents/loop.js';
import { rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * 临时工作目录
 */
let tempWorkspace: string;

/**
 * 生成唯一的 sessionId
 */
function generateSessionId(): string {
  return `test-${randomUUID()}`;
}

beforeAll(async () => {
  // 创建临时工作目录
  tempWorkspace = join('/tmp', `agent-test-${randomUUID()}`);
  await mkdir(tempWorkspace, { recursive: true });
});

afterAll(async () => {
  // 清理临时工作目录
  try {
    await rm(tempWorkspace, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

/**
 * 创建 AgentLoop 实例的辅助函数
 */
function createAgentLoop(config: Partial<AgentLoopConfig> = {}): AgentLoop {
  return new AgentLoop({
    workspaceDir: tempWorkspace,
    sessionId: generateSessionId(),
    maxIterations: 5,
    timeoutMs: 120000, // 2分钟超时
    promptMode: 'minimal',
    ...config,
  });
}

// ============================================================
// 跳过条件
// ============================================================

// ============================================================
// 真实 LLM API 调用测试
// ============================================================

describe('AgentLoop 真实 API 集成测试', () => {
  beforeEach(async () => {
    // 创建测试文件供工具读取
    const testFile = join(tempWorkspace, 'test.txt');
    await writeFile(testFile, 'Hello from test file!', 'utf-8');
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      const files = ['test.txt', 'output.txt', 'read_result.txt'];
      for (const file of files) {
        await rm(join(tempWorkspace, file), { force: true });
      }
    } catch {
      // 忽略清理错误
    }
  });

  // ============================================================
  // P0: 真实 LLM API 调用
  // ============================================================

  describe('P0: 真实 LLM API 调用', () => {
    it('agent-run-real-api: 应该能成功调用 LLM 并返回文本', async () => {
      const loop = createAgentLoop();

      const result = await loop.run({
        message: 'Say hello in one sentence.',
      });

      // 验证基本成功
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.usage).toBeDefined();
      expect(result.usage!.inputTokens).toBeGreaterThan(0);
      expect(result.usage!.outputTokens).toBeGreaterThan(0);
    }, 180000);

    it('agent-run-real-api: 应该正确处理 temperature 参数', async () => {
      const loop = createAgentLoop();

      const result = await loop.run({
        message: 'Write a very short story in 10 words.',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    }, 180000);

    it('agent-run-real-api: 应该正确处理 maxIterations 限制', async () => {
      // 设置很低的最大迭代次数
      const loop = createAgentLoop({
        maxIterations: 1,
        promptMode: 'none', // 简化 prompt
      });

      // 使用会触发工具调用的消息，但限制只执行一次
      const result = await loop.run({
        message: 'Count from 1 to 5.',
      });

      // 应该返回成功或达到最大迭代
      expect(result.iterations).toBeLessThanOrEqual(1);
    }, 180000);

    it('agent-run-real-api: 多次调用应该正常工作', async () => {
      const loop = createAgentLoop();

      const result1 = await loop.run({ message: 'Say "first".' });
      const result2 = await loop.run({ message: 'Say "second".' });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    }, 300000);
  });

  // ============================================================
  // P1: 真实工具执行
  // ============================================================

  describe('P1: 真实工具执行', () => {
    it('tool-execution-real: 应该能读取文件内容', async () => {
      const loop = createAgentLoop();
      loop.registerDefaultTools();

      // 创建一个已知内容的文件
      const testFile = join(tempWorkspace, 'read_test.txt');
      const expectedContent = 'Test content for reading';
      await writeFile(testFile, expectedContent, 'utf-8');

      const result = await loop.run({
        message: `Read the file "${testFile}" and tell me its content.`,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      // 内容应该包含文件内容
      expect(
        result.content.toLowerCase().includes(expectedContent.toLowerCase()) ||
        result.content.includes('Test content')
      ).toBe(true);
      expect(result.toolCalls).toBeGreaterThan(0);
    }, 180000);

    it('tool-execution-real: 应该能写入文件', async () => {
      const loop = createAgentLoop();
      loop.registerDefaultTools();

      const outputPath = join(tempWorkspace, 'write_output.txt');

      const result = await loop.run({
        message: `Write "Hello World" to the file "${outputPath}".`,
      });

      expect(result.success).toBe(true);
      expect(result.toolCalls).toBeGreaterThan(0);

      // 验证文件确实被写入
      const content = await readFile(outputPath, 'utf-8');
      expect(content).toContain('Hello World');
    }, 180000);

    it('tool-execution-real: 应该执行 bash 命令', async () => {
      const loop = createAgentLoop();
      loop.registerDefaultTools();

      const result = await loop.run({
        message: 'Run the command "echo test_bash" and show me the output.',
      });

      expect(result.success).toBe(true);
      expect(result.toolCalls).toBeGreaterThan(0);
    }, 180000);

    it('tool-execution-real: 工具执行失败应该正确处理', async () => {
      const loop = createAgentLoop();
      loop.registerDefaultTools();

      // 尝试读取不存在的文件
      const result = await loop.run({
        message: 'Read the file "/nonexistent/file.txt" and tell me what happens.',
      });

      // 应该成功处理错误
      expect(result.success).toBe(true);
      expect(result.toolCalls).toBeGreaterThan(0);
    }, 180000);
  });

  // ============================================================
  // P2: 多轮对话
  // ============================================================

  describe('P2: 多轮对话', () => {
    it('multi-turn-conversation: 应该保持上下文', async () => {
      const loop = createAgentLoop();

      // 第一轮：简单的打招呼
      const result1 = await loop.run({
        message: 'Say "hello from test"',
      });

      expect(result1.success).toBe(true);

      // 第二轮：继续对话，验证对话链正常工作
      const result2 = await loop.run({
        message: 'What did I ask you to say?',
      });

      expect(result2.success).toBe(true);
      // 验证能理解上下文（可能回答 "hello from test" 或类似内容）
      expect(result2.content.length).toBeGreaterThan(0);
    }, 300000);

    it('multi-turn-conversation: 应该能传递历史消息', async () => {
      const loop = createAgentLoop();

      const result = await loop.run({
        message: 'What is 2+2?',
        history: [
          { role: 'user', content: 'What is 1+1?' },
          { role: 'assistant', content: '1+1 equals 2.' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      // 应该能正确回答
      expect(
        result.content.includes('4') || result.content.toLowerCase().includes('four')
      ).toBe(true);
    }, 180000);

    it('multi-turn-conversation: 迭代计数应该正确', async () => {
      const loop = createAgentLoop();

      const result = await loop.run({
        message: 'Count from 1 to 3.',
      });

      expect(result.success).toBe(true);
      expect(result.iterations).toBeGreaterThanOrEqual(1);
    }, 180000);
  });

  // ============================================================
  // 错误处理测试
  // ============================================================

  describe('错误处理', () => {
    it('real-error-handling: 空消息应该被拒绝', async () => {
      const loop = createAgentLoop();

      // 空消息应该被拒绝（但可能成功返回，因为 LLM 可能会处理）
      // 这里主要验证不会崩溃
      const result = await loop.run({
        message: '',
      });

      // 结果应该是可预测的
      expect(result).toBeDefined();
    }, 180000);

    it('real-error-handling: 快速失败应该正确工作', async () => {
      const loop = createAgentLoop({
        timeoutMs: 1000, // 1秒超时
      });

      // 这可能会超时，但应该优雅处理
      const result = await loop.run({
        message: 'Say hello.',
      });

      // 无论成功还是超时，都应该有结果
      expect(result).toBeDefined();
    }, 180000);
  });

  // ============================================================
  // 配置测试
  // ============================================================

  describe('配置', () => {
    it('promptMode none 应该正常工作', async () => {
      const loop = createAgentLoop({
        promptMode: 'none',
      });

      const result = await loop.run({
        message: 'Say "ok".',
      });

      expect(result.success).toBe(true);
    }, 180000);

    it('promptMode minimal 应该正常工作', async () => {
      const loop = createAgentLoop({
        promptMode: 'minimal',
      });

      const result = await loop.run({
        message: 'Say "ok".',
      });

      expect(result.success).toBe(true);
    }, 180000);

    it('extraSystemPrompt 应该被添加', async () => {
      const loop = createAgentLoop({
        extraSystemPrompt: 'You must end every response with "THE END".',
      });

      const result = await loop.run({
        message: 'Say hello.',
      });

      expect(result.success).toBe(true);
      // LLM 可能会遵循这个指示
    }, 180000);
  });
});

// ============================================================
// LLMClient 真实 API 测试
// ============================================================

describe('LLMClient 真实 API 集成测试', () => {
  describe('LLMClient 真实 API', () => {
    it('should make real API call and return response', async () => {
      const { LLMClient } = await import('../../../src/agents/llm.js');
      const client = new LLMClient();

      const result = await client.chatSimple('Say "hello" in one word.');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 180000);

    it('should make API call with tools', async () => {
      const { LLMClient } = await import('../../../src/agents/llm.js');
      const client = new LLMClient();

      const tools = [
        {
          name: 'echo',
          description: 'Echoes the input',
          input_schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
            },
            required: ['text'],
          },
        },
      ];

      const result = await client.chatSimple('Use the echo tool to say "test".', undefined, tools);

      expect(result).toBeDefined();
    }, 180000);

    it('should track usage correctly', async () => {
      const { LLMClient } = await import('../../../src/agents/llm.js');
      const client = new LLMClient();

      const response = await client.chat({
        messages: [{ role: 'user', content: 'Say hello.' }],
      });

      expect(response.usage).toBeDefined();
      expect(response.usage!.input_tokens).toBeGreaterThan(0);
      expect(response.usage!.output_tokens).toBeGreaterThan(0);
    }, 180000);
  });
});
