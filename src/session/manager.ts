// Session 管理器
// 负责 Session 的创建、存储、查询和管理

import fs from 'node:fs/promises';
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

const STORAGE_DIR = './storage/sessions';

/**
 * 生成唯一 Session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}_${random}`;
}

/**
 * 确保存储目录存在
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch {
    // 目录已存在
  }
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

/**
 * 读取 Session 索引
 */
async function readIndex(): Promise<Record<string, SessionMetadata>> {
  try {
    const content = await fs.readFile(getIndexPath(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * 写入 Session 索引
 */
async function writeIndex(index: Record<string, SessionMetadata>): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(getIndexPath(), JSON.stringify(index, null, 2));
}

/**
 * 创建新 Session
 */
export async function createSession(options?: CreateSessionOptions): Promise<Session> {
  await ensureStorageDir();

  const now = Date.now();
  const sessionId = generateSessionId();

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

  // 保存 Session 文件
  await fs.writeFile(getSessionPath(sessionId), JSON.stringify(session, null, 2));

  // 更新索引
  const index = await readIndex();
  index[sessionId] = {
    id: sessionId,
    label: session.label,
    parentId: session.parentId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    config: session.config,
  };
  await writeIndex(index);

  return session;
}

/**
 * 获取 Session
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const content = await fs.readFile(getSessionPath(sessionId), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 更新 Session
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Session>,
): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const updated: Session = {
    ...session,
    ...updates,
    updatedAt: Date.now(),
  };

  await fs.writeFile(getSessionPath(sessionId), JSON.stringify(updated, null, 2));

  // 更新索引
  const index = await readIndex();
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
    await writeIndex(index);
  }

  return updated;
}

/**
 * 添加消息到 Session
 */
export async function addMessage(
  sessionId: string,
  message: Message,
): Promise<Session | null> {
  const session = await getSession(sessionId);
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
 * 添加工具调用记录
 */
export async function addToolCall(
  sessionId: string,
  toolCall: ToolCall,
): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  return updateSession(sessionId, {
    toolCalls: [...session.toolCalls, toolCall],
  });
}

/**
 * 更新 Token 使用量
 */
export async function updateUsage(
  sessionId: string,
  usage: TokenUsage,
): Promise<Session | null> {
  const session = await getSession(sessionId);
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
  if (options?.parentId) {
    sessions = sessions.filter((s) => s.parentId === options.parentId);
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
    await fs.unlink(getSessionPath(sessionId));

    const index = await readIndex();
    delete index[sessionId];
    await writeIndex(index);

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
