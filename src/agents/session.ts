/**
 * 会话管理模块
 *
 * 负责会话的创建、加载、保存和压缩
 */

import type {
  SessionEntry,
  Message,
} from './types.js';
import { AgentState } from './types.js';

/**
 * 会话存储接口
 */
export interface SessionStore {
  get(sessionKey: string): Promise<SessionEntry | null>;
  set(sessionKey: string, entry: SessionEntry): Promise<void>;
  delete(sessionKey: string): Promise<void>;
  list(): Promise<SessionEntry[]>;
}

/**
 * 内存会话存储 (默认实现)
 */
export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, SessionEntry>();

  async get(sessionKey: string): Promise<SessionEntry | null> {
    return this.store.get(sessionKey) ?? null;
  }

  async set(sessionKey: string, entry: SessionEntry): Promise<void> {
    this.store.set(sessionKey, entry);
  }

  async delete(sessionKey: string): Promise<void> {
    this.store.delete(sessionKey);
  }

  async list(): Promise<SessionEntry[]> {
    return Array.from(this.store.values());
  }
}

/**
 * 会话管理器
 */
export class SessionManager {
  private store: SessionStore;

  constructor(store?: SessionStore) {
    this.store = store ?? new InMemorySessionStore();
  }

  /**
   * 加载或创建会话
   */
  async loadOrCreate(sessionKey: string): Promise<SessionEntry> {
    const existing = await this.store.get(sessionKey);
    if (existing) {
      return existing;
    }

    // 创建新会话
    const newSession: SessionEntry = {
      sessionKey,
      accountId: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      state: AgentState.IDLE,
    };

    await this.store.set(sessionKey, newSession);
    return newSession;
  }

  /**
   * 更新会话
   */
  async update(sessionKey: string, updates: Partial<SessionEntry>): Promise<SessionEntry> {
    const session = await this.store.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }

    const updated: SessionEntry = {
      ...session,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.store.set(sessionKey, updated);
    return updated;
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionKey: string, message: Message): Promise<SessionEntry> {
    const session = await this.store.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }

    const updated: SessionEntry = {
      ...session,
      messages: [...session.messages, message],
      updatedAt: Date.now(),
    };

    await this.store.set(sessionKey, updated);
    return updated;
  }

  /**
   * 更新会话状态
   */
  async setState(sessionKey: string, state: AgentState): Promise<SessionEntry> {
    return this.update(sessionKey, { state });
  }

  /**
   * 获取会话消息历史
   */
  async getMessages(sessionKey: string, limit?: number): Promise<Message[]> {
    const session = await this.store.get(sessionKey);
    if (!session) {
      return [];
    }

    if (limit) {
      return session.messages.slice(-limit);
    }
    return session.messages;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionKey: string): Promise<void> {
    await this.store.delete(sessionKey);
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<SessionEntry[]> {
    return this.store.list();
  }

  /**
   * 会话压缩 - 减少消息历史以控制 token 使用
   */
  async compact(sessionKey: string, maxMessages: number = 100): Promise<SessionEntry> {
    const session = await this.store.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }

    const messages = session.messages;
    if (messages.length <= maxMessages) {
      return session;
    }

    // 保留系统消息和最近的 maxMessages 条消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    const recentMessages = otherMessages.slice(-maxMessages);

    const compactedSession: SessionEntry = {
      ...session,
      messages: [...systemMessages, ...recentMessages],
      updatedAt: Date.now(),
    };

    await this.store.set(sessionKey, compactedSession);
    return compactedSession;
  }
}

/**
 * 创建会话管理器工厂
 */
export function createSessionManager(store?: SessionStore): SessionManager {
  return new SessionManager(store);
}
