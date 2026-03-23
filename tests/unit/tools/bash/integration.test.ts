/**
 * Bash 工具真实 LLM API 集成测试
 *
 * 使用真实 LLM API 测试 Bash 工具的集成功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AgentLoop, type AgentLoopConfig } from '../../../../src/agents/loop.js';
import { createDefaultTools } from '../../../../src/tools/index.js';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

let tempWorkspace: string;

function generateSessionId(): string {
  return `bash-test-${randomUUID()}`;
}

beforeAll(async () => {
  tempWorkspace = join('/tmp', `bash-integration-test-${randomUUID()}`);
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

describe('Bash 工具集成测试', () => {
  beforeEach(async () => {
    await writeFile(join(tempWorkspace, 'test.txt'), 'Hello World', 'utf-8');
  });

  afterEach(async () => {
    try {
      await rm(join(tempWorkspace, 'output.txt'), { force: true });
    } catch {
      // 忽略
    }
  });

  it('exec 工具: 应该能执行简单命令', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Execute the command "echo 'test'" in the workspace ${tempWorkspace}`,
    });

    expect(result.success).toBe(true);
  }, 180000);

  it('exec 工具: 应该能执行文件操作命令', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `In workspace ${tempWorkspace}, execute "ls -la" to list files`,
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  }, 180000);

  it('exec 工具: 应该能处理命令错误', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Execute the command "ls /nonexistent-directory-12345" in ${tempWorkspace} and tell me what happens`,
    });

    // 命令可能失败但应该正确处理
    expect(result.content).toBeDefined();
  }, 180000);
});
