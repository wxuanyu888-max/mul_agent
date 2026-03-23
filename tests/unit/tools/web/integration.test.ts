/**
 * Web 工具真实 LLM API 集成测试
 *
 * 使用真实 LLM API 测试 Web 工具的集成功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentLoop, type AgentLoopConfig } from '../../../../src/agents/loop.js';
import { createDefaultTools } from '../../../../src/tools/index.js';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

let tempWorkspace: string;

function generateSessionId(): string {
  return `web-test-${randomUUID()}`;
}

beforeAll(async () => {
  tempWorkspace = join('/tmp', `web-integration-test-${randomUUID()}`);
  await mkdir(tempWorkspace, { recursive: true });
});

afterAll(async () => {
  try {
    await rm(tempWorkspace, { recursive: true, force: true });
  } catch {
    // 忽略
  }
});

function createAgentLoop(config: Partial<AgentLoopConfig> = {}): AgentLoop {
  const loop = new AgentLoop({
    workspaceDir: tempWorkspace,
    sessionId: generateSessionId(),
    maxIterations: 10,
    timeoutMs: 180000,
    promptMode: 'minimal',
    ...config,
  });

  const tools = createDefaultTools({ sessionId: loop.getConversationRound().toString() });
  loop.registerTools(tools);

  return loop;
}

describe('Web 工具集成测试', () => {
  it('web_search 工具: 应该能搜索网页', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'Search for "TypeScript latest version" on the web and tell me the result',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  }, 180000);

  it('web_fetch 工具: 应该能获取网页内容', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'Fetch the content from https://example.com and tell me what you see',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  }, 180000);
});
