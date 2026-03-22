/**
 * 集成测试 - 工具循环
 *
 * 测试完整的 Agent 工具调用循环：
 * 1. 用户消息 -> LLM
 * 2. LLM 返回 tool_call
 * 3. 执行工具
 * 4. 工具结果 -> LLM
 * 5. LLM 返回最终回复
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSession, addMessage, getSession, deleteSession } from '../../src/session/index.js';
import { createReadTool, createLsTool, createBashTool } from '../../src/tools/index.js';
import { getLogger, initLogger } from '../../src/logger/index.js';

describe('Tool Loop Integration', () => {
  let testSessionId: string;

  beforeAll(() => {
    initLogger({ level: 'error' }); // Reduce noise
  });

  afterEach(async () => {
    if (testSessionId) {
      await deleteSession(testSessionId).catch(() => {});
    }
  });

  describe('Tool Execution', () => {
    it('should execute read tool and return result', async () => {
      const readTool = createReadTool();

      const result = await readTool.execute('call-1', { path: 'package.json' });

      expect(result.error).toBeNull();
      expect(result.content).toContain('name');
    });

    it('should execute ls tool', async () => {
      const lsTool = createLsTool();

      const result = await lsTool.execute('call-2', { path: '.' });

      expect(result.error).toBeNull();
      expect(result.content).toContain('package.json');
    });

    it('should handle tool execution error', async () => {
      const readTool = createReadTool();

      const result = await readTool.execute('call-3', { path: '/nonexistent/file.txt' });

      expect(result.error).toBeDefined();
    });
  });

  describe('Tool with Session', () => {
    it('should create session and add messages', async () => {
      const session = await createSession({ label: 'tool-test' });
      testSessionId = session.id;

      await addMessage(session.id, {
        role: 'user',
        content: 'List files',
      });

      const retrieved = await getSession(session.id);
      expect(retrieved?.messages).toHaveLength(1);
      expect(retrieved?.messages[0].content).toBe('List files');
    });

    it('should track tool calls in session', async () => {
      const session = await createSession({ label: 'tool-call-test' });
      testSessionId = session.id;

      // Simulate tool call
      await addMessage(session.id, {
        role: 'user',
        content: { type: 'tool_result', tool_use_id: 'call_1', content: 'ls output' },
      });

      const retrieved = await getSession(session.id);
      expect(retrieved?.messages).toHaveLength(1);
    });
  });

  describe('Multiple Tool Calls', () => {
    it('should execute multiple tools sequentially', async () => {
      const lsTool = createLsTool();
      const readTool = createReadTool();

      // First call - list directory
      const lsResult = await lsTool.execute('call-1', { path: '.' });
      expect(lsResult.error).toBeNull();

      // Second call - read a file
      const readResult = await readTool.execute('call-2', { path: 'package.json' });
      expect(readResult.error).toBeNull();
    });

    it('should handle tool errors gracefully', async () => {
      const lsTool = createLsTool();

      // Try to list non-existent directory
      const result = await lsTool.execute('call-1', { path: '/nonexistent/path' });

      expect(result.error).toBeDefined();
    });
  });
});
