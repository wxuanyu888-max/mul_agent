/**
 * Message 工具单元测试
 *
 * 测试消息工具的功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMessageTool } from '../../../../src/tools/message/index.js';

describe('Message 工具', () => {
  let messageTool: ReturnType<typeof createMessageTool>;

  beforeEach(() => {
    messageTool = createMessageTool();
  });

  describe('工具定义', () => {
    it('应该正确创建 message 工具', () => {
      expect(messageTool.name).toBe('message');
      expect(messageTool.label).toBe('Message');
      expect(messageTool.description).toBe('Send messages and channel actions');
    });

    it('应该定义正确的参数模式', () => {
      expect(messageTool.parameters.type).toBe('object');
      expect(messageTool.parameters.properties.action).toBeDefined();
      expect(messageTool.parameters.properties.action.enum).toContain('send');
      expect(messageTool.parameters.properties.action.enum).toContain('react');
      expect(messageTool.parameters.properties.action.enum).toContain('reply');
      expect(messageTool.parameters.required).toContain('action');
      expect(messageTool.parameters.required).toContain('message');
    });
  });

  describe('send 动作', () => {
    it('应该能发送消息', async () => {
      const result = await messageTool.execute('test-call-id', {
        action: 'send',
        message: 'Hello World',
      });

      expect(result.content).toBeDefined();
      expect(result.content).toContain('Hello World');
      expect(result.content).toContain('send');
    });

    it('应该支持指定接收者', async () => {
      const result = await messageTool.execute('test-call-id', {
        action: 'send',
        to: 'user123',
        message: 'Hello',
      });

      expect(result.content).toContain('user123');
    });

    it('应该支持指定频道', async () => {
      const result = await messageTool.execute('test-call-id', {
        action: 'send',
        channel: 'general',
        message: 'Hello channel',
      });

      expect(result.content).toContain('general');
    });
  });

  describe('react 动作', () => {
    it('应该能发送反应', async () => {
      const result = await messageTool.execute('test-call-id', {
        action: 'react',
        to: 'message123',
        message: '👍',
      });

      expect(result.content).toContain('react');
    });
  });

  describe('reply 动作', () => {
    it('应该能回复消息', async () => {
      const result = await messageTool.execute('test-call-id', {
        action: 'reply',
        to: 'message123',
        message: 'This is a reply',
      });

      expect(result.content).toContain('reply');
      expect(result.content).toContain('message123');
    });
  });
});
