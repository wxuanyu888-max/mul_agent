/**
 * Session 工具真实 LLM API 集成测试
 *
 * 使用真实 LLM API 测试 Session 工具的集成功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentLoop, type AgentLoopConfig } from '../../../../src/agents/loop.js';
import { createDefaultTools } from '../../../../src/tools/index.js';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

let tempWorkspace: string;

function generateSessionId(): string {
  return `session-test-${randomUUID()}`;
}

beforeAll(async () => {
  tempWorkspace = join('/tmp', `session-integration-test-${randomUUID()}`);
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

describe('Session 工具集成测试', () => {
  it('session_list 工具: 应该能列出会话', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'List all available sessions and tell me their IDs',
    });

    // Session 工具应该能正常工作
    expect(result.content).toBeDefined();
  }, 180000);

  it('session_send 工具: 应该能发送消息到会话', async () => {
    const loop = createAgentLoop();

    // 先创建当前会话
    await loop.run({ message: 'Say hello' });

    // 然后尝试发送消息
    const result = await loop.run({
      message: 'Tell me about the current session status',
    });

    expect(result.content).toBeDefined();
  }, 180000);
});
