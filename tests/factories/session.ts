/**
 * Session Factory - 创建测试用的 Session 对象
 */

import type { Session, SessionConfig, Message } from '../../src/session/types.js';

export interface SessionFactoryOptions {
  id?: string;
  label?: string;
  status?: 'active' | 'idle' | 'completed';
  messages?: Message[];
  toolCalls?: any[];
  config?: Partial<SessionConfig>;
  usage?: { input: number; output: number; total: number };
  createdAt?: number;
  updatedAt?: number;
  parentId?: string;
}

export const createSession = (options: SessionFactoryOptions = {}): Session => {
  const now = Date.now();
  return {
    id: options.id ?? `session-${now}`,
    label: options.label ?? 'Test Session',
    status: options.status ?? 'active',
    messages: options.messages ?? [],
    toolCalls: options.toolCalls ?? [],
    usage: options.usage ?? { input: 0, output: 0, total: 0 },
    config: {
      model: 'claude-sonnet-4-20250514',
      runtime: 'main',
      temperature: 1.0,
      maxTokens: 4096,
      ...options.config,
    },
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
    parentId: options.parentId,
  };
};

export const createSessionWithMessages = (messages: Message[], options: SessionFactoryOptions = {}) =>
  createSession({ ...options, messages });

export const createActiveSession = (options: SessionFactoryOptions = {}) =>
  createSession({ ...options, status: 'active' });

export const createCompletedSession = (options: SessionFactoryOptions = {}) =>
  createSession({ ...options, status: 'completed' });

export const createEmptySession = (options: SessionFactoryOptions = {}) =>
  createSession({ ...options, messages: [], toolCalls: [] });

export const createSessionWithToolCalls = (toolCalls: any[], options: SessionFactoryOptions = {}) =>
  createSession({ ...options, toolCalls });
