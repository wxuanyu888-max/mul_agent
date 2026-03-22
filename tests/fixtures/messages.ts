/**
 * Message Fixtures - 静态测试数据
 */

import type { Message } from '../../src/session/types.js';

export const userMessage: Message = {
  role: 'user',
  content: 'Hello, agent!',
  timestamp: 1000,
};

export const assistantMessage: Message = {
  role: 'assistant',
  content: 'Hello! How can I help?',
  timestamp: 2000,
};

export const systemMessage: Message = {
  role: 'system',
  content: 'You are a helpful assistant.',
  timestamp: 500,
};

export const toolResultMessage: Message = {
  role: 'user',
  content: {
    type: 'tool_result',
    tool_use_id: 'tool-call-1',
    content: 'file content here',
  },
  timestamp: 3000,
};

export const messages = [userMessage, assistantMessage];

export const messagesWithTool = [
  userMessage,
  assistantMessage,
  toolResultMessage,
];

export const longMessageChain = Array.from({ length: 20 }, (_, i) => ({
  role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
  content: `Message ${i + 1}`,
  timestamp: (i + 1) * 1000,
}));
