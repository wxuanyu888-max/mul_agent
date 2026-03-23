/**
 * 工具真实 LLM API 集成测试
 *
 * 使用真实 LLM API 测试所有核心工具的集成功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AgentLoop, type AgentLoopConfig } from '../../src/agents/loop.js';
import { createDefaultTools } from '../../src/tools/index.js';
import { rm, writeFile, mkdir, readFile, stat } from 'node:fs/promises';
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
  return `tool-test-${randomUUID()}`;
}

beforeAll(async () => {
  tempWorkspace = join('/tmp', `tool-integration-test-${randomUUID()}`);
  await mkdir(tempWorkspace, { recursive: true });
});

afterAll(async () => {
  try {
    await rm(tempWorkspace, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

/**
 * 创建 AgentLoop 实例
 */
function createAgentLoop(config: Partial<AgentLoopConfig> = {}): AgentLoop {
  const loop = new AgentLoop({
    workspaceDir: tempWorkspace,
    sessionId: generateSessionId(),
    maxIterations: 10,
    timeoutMs: 180000,
    promptMode: 'minimal',
    ...config,
  });

  // 注册所有默认工具
  const tools = createDefaultTools({ sessionId: loop.getConversationRound().toString() });
  loop.registerTools(tools);

  return loop;
}

// ============================================================
// File 工具测试
// ============================================================

describe('File 工具集成测试', () => {
  beforeEach(async () => {
    // 创建测试文件
    await writeFile(join(tempWorkspace, 'test.txt'), 'Hello World!', 'utf-8');
    await writeFile(join(tempWorkspace, 'data.json'), '{"name": "test", "value": 123}', 'utf-8');
    await mkdir(join(tempWorkspace, 'subdir'), { recursive: true });
    await writeFile(join(tempWorkspace, 'subdir', 'nested.txt'), 'Nested content', 'utf-8');
  });

  afterEach(async () => {
    // 清理测试文件
    const files = [
      'test.txt', 'data.json', 'output.txt', 'result.txt',
      'subdir/nested.txt', 'newfile.txt', 'edited.txt'
    ];
    for (const file of files) {
      try {
        await rm(join(tempWorkspace, file), { force: true });
      } catch {
        // 忽略
      }
    }
  });

  it('read 工具: 应该能读取文件内容', async () => {
    const loop = createAgentLoop();
    const filePath = join(tempWorkspace, 'test.txt');

    const result = await loop.run({
      message: `Read the file "${filePath}" and tell me its content.`,
    });

    expect(result.success).toBe(true);
    expect(result.content.toLowerCase()).toContain('hello');
    expect(result.toolCalls).toBeGreaterThan(0);
  }, 180000);

  it('write 工具: 应该能写入文件', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Write the following content to file "${join(tempWorkspace, 'output.txt')}": "Test output content"`,
    });

    expect(result.success).toBe(true);
  }, 180000);

  it('ls 工具: 应该能列出目录内容', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `List all files in directory "${tempWorkspace}"`,
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain('test.txt');
  }, 180000);

  it('grep 工具: 应该能在文件中搜索', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Search for "Hello" in file "${join(tempWorkspace, 'test.txt')}"`,
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('edit 工具: 应该能编辑文件', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Edit the file "${join(tempWorkspace, 'test.txt')}" to replace "Hello" with "Hi"`,
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('find 工具: 应该能找到文件', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Find all .txt files in "${tempWorkspace}"`,
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// Bash 工具测试
// ============================================================

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

  it('exec 工具: 应该能执行命令', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Execute the command "echo 'test'" in the workspace ${tempWorkspace}`,
    });

    expect(result.success).toBe(true);
  }, 180000);

  it('exec 工具: 应该能执行复杂命令', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `In workspace ${tempWorkspace}, execute "ls -la" to list files`,
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  }, 180000);

  it('exec 工具: 应该处理命令错误', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Execute the command "ls /nonexistent-directory-12345" in ${tempWorkspace} and tell me what happens`,
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// Task 工具测试
// ============================================================

describe('Task 工具集成测试', () => {
  it('task 工具: 应该能列出任务', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'List all available tasks',
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('task 工具: 应该能创建任务', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'Create a new task with title "Test Task" and description "This is a test"',
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// Memory 工具测试
// ============================================================

describe('Memory 工具集成测试', () => {
  it('memory 工具: 应该能写入记忆', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'Remember that the user prefers dark mode',
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('memory 工具: 应该能搜索记忆', async () => {
    const loop = createAgentLoop();

    // 先写入记忆
    await loop.run({
      message: 'Remember that the user prefers dark mode',
    });

    // 搜索记忆
    const result = await loop.run({
      message: 'What does the user prefer?',
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// Sessions 工具测试
// ============================================================

describe('Sessions 工具集成测试', () => {
  it('sessions 工具: 应该能列出会话', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'List all available sessions and tell me their IDs',
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('sessions 工具: 应该能获取会话状态', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'Tell me about the current session status',
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// Web 工具测试
// ============================================================

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

// ============================================================
// 系统工具测试
// ============================================================

describe('系统工具集成测试', () => {
  it('cron 工具: 应该能列出定时任务', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'List all scheduled cron jobs',
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('subagents 工具: 应该能列出子代理', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'List all available subagents',
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('agents_list 工具: 应该能列出代理', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'List all agents',
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// Compact 工具测试
// ============================================================

describe('Compact 工具集成测试', () => {
  it('compact 工具: 应该能触发压缩', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'Trigger context compaction',
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// 组合工具测试
// ============================================================

describe('组合工具集成测试', () => {
  afterEach(async () => {
    try {
      await rm(join(tempWorkspace, 'combined.txt'), { force: true });
    } catch {
      // 忽略
    }
  });

  it('组合工具: 读取后写入', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Read file "${join(tempWorkspace, 'test.txt')}" and write its content to "${join(tempWorkspace, 'combined.txt')}"`,
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('组合工具: 执行命令并读取结果', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Execute "echo 'test' > ${tempWorkspace}/output.txt" then read the file`,
    });

    expect(result.content).toBeDefined();
  }, 180000);
});

// ============================================================
// 错误处理测试
// ============================================================

describe('工具错误处理集成测试', () => {
  it('读取不存在的文件应该正确处理', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Read file "/tmp/nonexistent-file-${randomUUID()}.txt"`,
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('执行无效命令应该正确处理', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: `Execute command "nonexistent-command-${randomUUID()}"`,
    });

    expect(result.content).toBeDefined();
  }, 180000);

  it('访问无效URL应该正确处理', async () => {
    const loop = createAgentLoop();

    const result = await loop.run({
      message: 'Fetch from https://this-domain-does-not-exist-12345.com',
    });

    expect(result.content).toBeDefined();
  }, 180000);
});
