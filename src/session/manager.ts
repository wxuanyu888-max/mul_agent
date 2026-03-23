// Session 管理器
// 负责 Session 的创建、存储、查询和管理
//
// 性能优化：
// 1. 内存缓存 - 减少磁盘读写
// 2. 批量写入 - 合并多次更新为一次写入
// 3. 脏标记 - 仅写入变更的数据
// 4. 定期刷新 - 后台定时保存

import path from 'node:path';
import {
  type Session,
  type SessionMetadata,
  type Message,
  type ToolCall,
  type TokenUsage,
  type CreateSessionOptions,
  type QuerySessionsOptions,
  type SessionStatus,
} from './types.js';
import { getSessionsPath, getSessionWorkspacePath, getSessionTasksPath } from '../utils/path.js';
import { StorageCache } from '../storage/cache/cache.js';
import { JsonStorageBackend } from '../storage/backend/json.js';
import { withFileLock, atomicReadJson, atomicWriteJson, ensureDir } from '../utils/file-lock.js';

const STORAGE_DIR = getSessionsPath();
const FLUSH_INTERVAL_MS = 5000; // 5秒定期刷新
const MAX_CACHE_SIZE = 100; // 最大缓存会话数

/**
 * 生成唯一 Session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}_${random}`;
}

/**
 * Session 文件路径
 */
function getSessionPath(sessionId: string): string {
  return path.join(STORAGE_DIR, `${sessionId}.json`);
}

/**
 * Session 索引文件路径
 */
function getIndexPath(): string {
  return path.join(STORAGE_DIR, 'index.json');
}

// ============================================================================
// SessionCache - 继承 StorageCache
// ============================================================================

interface SessionCacheEntry {
  session: Session;
  metadata: SessionMetadata;
}

class SessionCache extends StorageCache<Session> {
  private metadataCache = new Map<string, SessionMetadata>();
  private backend: JsonStorageBackend;

  constructor(backend: JsonStorageBackend) {
    super({ maxSize: MAX_CACHE_SIZE, flushInterval: FLUSH_INTERVAL_MS });
    this.backend = backend;
  }

  /**
   * 从磁盘加载会话
   */
  async loadFromDisk(sessionId: string): Promise<Session | null> {
    // 直接使用 atomicReadJson 以兼容测试 mock
    const session = await atomicReadJson<Session>(getSessionPath(sessionId));
    return session;
  }

  /**
   * 覆盖 get 方法：优先从缓存，没有则从磁盘加载
   */
  async get(sessionId: string): Promise<Session | null> {
    const cached = await super.get(sessionId);
    if (cached) {
      return cached;
    }

    // 从磁盘读取
    const session = await this.loadFromDisk(sessionId);
    if (session) {
      this.addSession(session, false);
      return session;
    }
    return null;
  }

  /**
   * 添加会话：同时更新 metadata 缓存
   */
  addSession(session: Session, dirty = true): void {
    super.set(session.id, session, dirty);

    // 同时更新 metadata 缓存
    const metadata: SessionMetadata = {
      id: session.id,
      label: session.label,
      parentId: session.parentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      status: session.status,
      config: session.config,
    };
    this.metadataCache.set(session.id, metadata);
  }

  /**
   * 删除会话
   */
  delete(sessionId: string): void {
    super.delete(sessionId);
    this.metadataCache.delete(sessionId);
  }

  /**
   * 获取 metadata（从缓存或磁盘）
   */
  async getMetadata(sessionId: string): Promise<SessionMetadata | null> {
    const cached = this.metadataCache.get(sessionId);
    if (cached) {
      return cached;
    }

    const index = await this.loadIndex();
    const metadata = index[sessionId];
    if (metadata) {
      this.metadataCache.set(sessionId, metadata);
    }
    return metadata ?? null;
  }

  /**
   * 获取所有 metadata
   */
  async getAllMetadata(): Promise<Record<string, SessionMetadata>> {
    return this.loadIndex();
  }

  /**
   * 加载索引
   */
  private async loadIndex(): Promise<Record<string, SessionMetadata>> {
    // 直接使用 atomicReadJson 以兼容测试 mock
    const data = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath());
    return data || {};
  }

  /**
   * 覆盖 flush 方法：刷新会话到磁盘
   */
  async flush(): Promise<void> {
    const dirtyEntries = this.getDirtyEntries();
    if (dirtyEntries.size === 0) {
      return;
    }

    // 确保目录存在
    await ensureDir(STORAGE_DIR);

    // 批量写入会话文件
    const promises: Promise<void>[] = [];
    for (const [id, session] of dirtyEntries) {
      promises.push(
        atomicWriteJson(getSessionPath(id), session).then(() => {
          this.markDirty(id); // 标记为已刷新
        })
      );
    }

    // 同时刷新索引
    promises.push(this.flushIndex());

    await Promise.all(promises);
  }

  /**
   * 刷新索引到磁盘
   */
  private async flushIndex(): Promise<void> {
    const index: Record<string, SessionMetadata> = {};
    for (const [id, metadata] of this.metadataCache) {
      index[id] = metadata;
    }
    await atomicWriteJson(getIndexPath(), index);
  }

  /**
   * 更新 metadata
   */
  updateMetadata(sessionId: string, metadata: SessionMetadata): void {
    this.metadataCache.set(sessionId, metadata);
    this.markDirty(sessionId);
  }

  /**
   * 加载所有 metadata 到缓存
   */
  async loadAllMetadata(): Promise<void> {
    const index = await this.loadIndex();
    for (const [id, metadata] of Object.entries(index)) {
      this.metadataCache.set(id, metadata);
    }
  }
}

// ============================================================================
// 初始化后端和缓存
// ============================================================================

const backend = new JsonStorageBackend({ baseDir: STORAGE_DIR });
const globalCache = new SessionCache(backend);

// 启动定期刷新
globalCache.start();

// 启动时加载索引到缓存
globalCache.loadAllMetadata().catch(console.error);

/**
 * 读取 Session 索引
 */
async function readIndex(): Promise<Record<string, SessionMetadata>> {
  return globalCache.getAllMetadata();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function writeIndex(index: Record<string, SessionMetadata>): Promise<void> {
  for (const [id, metadata] of Object.entries(index)) {
    globalCache.updateMetadata(id, metadata);
  }
}

/**
 * 创建新 Session
 */
export async function createSession(options?: CreateSessionOptions): Promise<Session> {
  const now = Date.now();
  const sessionId = options?.id || generateSessionId();

  const session: Session = {
    id: sessionId,
    label: options?.label,
    parentId: options?.parentId,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    config: {
      runtime: options?.config?.runtime || 'main',
      model: options?.config?.model || 'claude-sonnet-4-20250514',
      temperature: options?.config?.temperature ?? 1.0,
      maxTokens: options?.config?.maxTokens,
      systemPrompt: options?.config?.systemPrompt,
      tools: options?.config?.tools || [],
      timeoutSeconds: options?.config?.timeoutSeconds,
    },
    messages: [],
    toolCalls: [],
    usage: {
      input: 0,
      output: 0,
      total: 0,
    },
  };

  // 保存到缓存（标记为脏，等待定期刷新）
  globalCache.addSession(session, true);

  // 立即写入以确保持久化（create 是关键操作）
  await backend.write(getSessionPath(sessionId), session);

  // 使用文件锁更新索引，防止并发冲突
  await withFileLock(getIndexPath(), async () => {
    const index = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath()) || {};
    index[sessionId] = {
      id: sessionId,
      label: session.label,
      parentId: session.parentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      status: session.status,
      config: session.config,
    };
    await backend.write(getIndexPath(), index);
  });

  // 创建 session 专属目录：workspace 和 tasks
  await ensureDir(getSessionWorkspacePath(sessionId));
  await ensureDir(getSessionTasksPath(sessionId));

  return session;
}

/**
 * 获取 Session（优先从缓存）
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  return globalCache.get(sessionId);
}

/**
 * 更新 Session（批量写入优化）
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Session>,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  const updated: Session = {
    ...session,
    ...updates,
    updatedAt: Date.now(),
  };

  // 更新缓存（标记为脏）
  globalCache.addSession(updated, true);

  // 使用文件锁更新索引，防止并发冲突
  await withFileLock(getIndexPath(), async () => {
    const index = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath()) || {};
    if (index[sessionId]) {
      index[sessionId] = {
        id: updated.id,
        label: updated.label,
        parentId: updated.parentId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        status: updated.status,
        config: updated.config,
      };
      await backend.write(getIndexPath(), index);
    }
  });

  return updated;
}

/**
 * 添加消息到 Session（批量写入优化）
 */
export async function addMessage(
  sessionId: string,
  message: Message,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  const messageWithTimestamp = {
    ...message,
    timestamp: message.timestamp || Date.now(),
  };

  return updateSession(sessionId, {
    messages: [...session.messages, messageWithTimestamp],
  });
}

/**
 * 添加工具调用记录（批量写入优化）
 */
export async function addToolCall(
  sessionId: string,
  toolCall: ToolCall,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  return updateSession(sessionId, {
    toolCalls: [...session.toolCalls, toolCall],
  });
}

/**
 * 更新 Token 使用量（批量写入优化）
 */
export async function updateUsage(
  sessionId: string,
  usage: TokenUsage,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  const currentUsage = session.usage || { input: 0, output: 0, total: 0 };
  return updateSession(sessionId, {
    usage: {
      input: currentUsage.input + usage.input,
      output: currentUsage.output + usage.output,
      total: currentUsage.total + usage.total,
    },
  });
}

/**
 * 查询 Sessions
 */
export async function querySessions(options?: QuerySessionsOptions): Promise<SessionMetadata[]> {
  const index = await readIndex();

  let sessions = Object.values(index);

  // 按更新时间倒序
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);

  // 过滤
  if (options?.status) {
    sessions = sessions.filter((s) => s.status === options.status);
  }
  // 只有在传递了有效的 parentId（非空字符串）时才过滤
  if (options?.parentId && options.parentId.trim()) {
    // 优先匹配 parentId，同时也返回没有 parentId 的 session（兼容旧数据）
    sessions = sessions.filter((s) => s.parentId === options.parentId || !s.parentId);
  }
  if (options?.label) {
    sessions = sessions.filter((s) => s.label?.includes(options.label!));
  }

  // 分页
  if (options?.offset) {
    sessions = sessions.slice(options.offset);
  }
  if (options?.limit) {
    sessions = sessions.slice(0, options.limit);
  }

  return sessions;
}

/**
 * 获取所有活跃 Sessions
 */
export async function getActiveSessions(): Promise<SessionMetadata[]> {
  return querySessions({ status: 'active' });
}

/**
 * 删除 Session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    // 先检查 session 是否存在
    const existing = await globalCache.get(sessionId);
    if (!existing) {
      // 检查磁盘上是否存在
      const diskSession = await atomicReadJson<Session>(getSessionPath(sessionId));
      if (!diskSession) {
        return false;
      }
    }

    await globalCache.flush(); // 先刷新以确保没有待写入的数据
    await backend.delete(getSessionPath(sessionId));

    // 使用文件锁删除索引，防止并发冲突
    await withFileLock(getIndexPath(), async () => {
      const index = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath()) || {};
      delete index[sessionId];
      await atomicWriteJson(getIndexPath(), index);
    });

    globalCache.delete(sessionId);

    return true;
  } catch {
    return false;
  }
}

/**
 * 更新 Session 状态
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<Session | null> {
  return updateSession(sessionId, { status });
}

/**
 * 刷新所有缓存到磁盘（手动触发）
 */
export async function flushSessions(): Promise<void> {
  await globalCache.flush();
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): { size: number; pending: number } {
  return globalCache.getStats();
}

/**
 * 关闭会话管理器（清理资源）
 */
export async function closeSessionManager(): Promise<void> {
  await globalCache.stop();
}
