/**
 * Session Fixtures - 静态测试数据
 */

import type { Session, Message, ToolCall, TokenUsage } from '../../src/session/types.js';

export const emptySession: Session = {
  id: 'session-empty',
  label: 'Empty Session',
  status: 'active',
  messages: [],
  toolCalls: [],
  usage: { input: 0, output: 0, total: 0 },
  createdAt: 1000,
  updatedAt: 1000,
};

export const sessionWithMessages: Session = {
  id: 'session-messages',
  label: 'Session With Messages',
  status: 'active',
  messages: [
    {
      role: 'user',
      content: 'Hello',
      timestamp: 1000,
    },
    {
      role: 'assistant',
      content: 'Hi there!',
      timestamp: 2000,
    },
  ],
  toolCalls: [],
  usage: { input: 100, output: 50, total: 150 },
  createdAt: 1000,
  updatedAt: 2000,
};

export const sessionWithToolCalls: Session = {
  id: 'session-tools',
  label: 'Session With Tools',
  status: 'active',
  messages: [
    {
      role: 'user',
      content: 'List files',
      timestamp: 1000,
    },
  ],
  toolCalls: [
    {
      id: 'tool-call-1',
      name: 'bash',
      input: { command: 'ls -la' },
      result: 'total 0\n.',
      timestamp: 2000,
    },
  ],
  usage: { input: 200, output: 100, total: 300 },
  createdAt: 1000,
  updatedAt: 3000,
};

export const completedSession: Session = {
  id: 'session-completed',
  label: 'Completed Session',
  status: 'completed',
  messages: [
    {
      role: 'user',
      content: 'Hello',
      timestamp: 1000,
    },
    {
      role: 'assistant',
      content: 'Done!',
      timestamp: 2000,
    },
  ],
  toolCalls: [],
  usage: { input: 100, output: 50, total: 150 },
  createdAt: 1000,
  updatedAt: 2000,
};

export const sessionIndex = {
  'session-1': { id: 'session-1', label: 'Session 1', status: 'active', updatedAt: 100 },
  'session-2': { id: 'session-2', label: 'Session 2', status: 'active', updatedAt: 200 },
  'session-3': { id: 'session-3', label: 'Session 3', status: 'completed', updatedAt: 50 },
};
