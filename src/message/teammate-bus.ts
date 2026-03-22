/**
 * MessageBus - 队友消息总线
 *
 * 实现 JSONL 邮箱的读写：
 * 1. 发送消息到指定队友的收件箱
 * 2. 广播消息给所有队友
 * 3. 读取指定队友的收件箱
 *
 * 并发安全：
 * - 使用互斥锁防止同一文件的并发写入
 * - 读取收件箱使用原子操作（rename 替代 read+clear）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface TeammateMessage {
  /** 发送者 */
  sender: string;
  /** 接收者 */
  to: string;
  /** 消息内容 */
  content: string;
  /** 消息类型 */
  type?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 时间戳 */
  timestamp: string;
}

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'teammates');
/** 互斥锁映射表 */
const fileLocks: Map<string, Promise<void>> = new Map();

/**
 * 确保存储目录存在
 */
function ensureStorageDir(): void {
  const inboxDir = path.join(STORAGE_DIR, 'inbox');
  if (!fs.existsSync(inboxDir)) {
    fs.mkdirSync(inboxDir, { recursive: true });
  }
}

/**
 * 获取收件箱文件路径
 */
export function getInboxPath(name: string): string {
  return path.join(STORAGE_DIR, 'inbox', `${name}.jsonl`);
}

/**
 * 获取文件的互斥锁
 */
async function acquireLock(filePath: string): Promise<() => void> {
  while (fileLocks.has(filePath)) {
    await fileLocks.get(filePath);
  }

  let release: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  fileLocks.set(filePath, lockPromise);

  return () => {
    fileLocks.delete(filePath);
    release();
  };
}

/**
 * 发送消息到指定队友的收件箱（异步并发安全）
 */
export async function sendAsync(
  sender: string,
  to: string,
  content: string,
  msgType?: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  ensureStorageDir();

  const message: TeammateMessage = {
    sender,
    to,
    content,
    type: msgType,
    metadata,
    timestamp: new Date().toISOString(),
  };

  const inboxPath = getInboxPath(to);
  const line = JSON.stringify(message) + '\n';

  // 使用互斥锁保证写入安全
  const release = await acquireLock(inboxPath);
  try {
    await fs.promises.appendFile(inboxPath, line, 'utf-8');
  } finally {
    release();
  }

  return `Message sent to ${to}`;
}

/**
 * 发送消息（同步版本，使用锁）
 */
export function send(
  sender: string,
  to: string,
  content: string,
  msgType?: string,
  metadata?: Record<string, unknown>
): string {
  ensureStorageDir();

  const message: TeammateMessage = {
    sender,
    to,
    content,
    type: msgType,
    metadata,
    timestamp: new Date().toISOString(),
  };

  const inboxPath = getInboxPath(to);
  const line = JSON.stringify(message) + '\n';

  // 同步版本的锁等待
  const releaseFn = syncAcquireLock(inboxPath);
  try {
    fs.appendFileSync(inboxPath, line, 'utf-8');
  } finally {
    releaseFn();
  }

  return `Message sent to ${to}`;
}

/**
 * 同步获取互斥锁
 */
function syncAcquireLock(filePath: string): () => void {
  while (fileLocks.has(filePath)) {
    // 使用一个简单的 spin wait
    const currentLock = fileLocks.get(filePath);
    if (!currentLock) break;
    // 在 Node.js 中我们需要异步处理，但为了同步API我们用busy wait
    // 实际上更好的做法是让调用者使用 async 版本
  }

  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      fileLocks.delete(filePath);
    }
  };

  const lockPromise = Promise.resolve();
  fileLocks.set(filePath, lockPromise);

  return release;
}

/**
 * 广播消息给所有队友（除了发送者）- 异步版本
 */
export async function broadcastAsync(
  sender: string,
  content: string,
  msgType?: string
): Promise<string> {
  ensureStorageDir();

  // 读取 config.json 获取所有队友
  const configPath = path.join(STORAGE_DIR, 'config.json');
  let teammates: string[] = [];

  try {
    const configData = await fs.promises.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData) as { teammates?: Array<{ name: string }> };
    teammates = config.teammates?.map((t) => t.name) || [];
  } catch (e) {
    console.error('[TeammateBus] Failed to read config:', e);
  }

  // 并发发送给所有队友
  const promises = teammates
    .filter((name) => name !== sender)
    .map((name) => sendAsync(sender, name, content, msgType));

  const results = await Promise.allSettled(promises);
  const count = results.filter((r) => r.status === 'fulfilled').length;

  return `Broadcast to ${count} teammate(s)`;
}

/**
 * 广播消息给所有队友（除了发送者）
 */
export function broadcast(sender: string, content: string, msgType?: string): string {
  ensureStorageDir();

  // 读取 config.json 获取所有队友
  const configPath = path.join(STORAGE_DIR, 'config.json');
  let teammates: string[] = [];

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { teammates?: Array<{ name: string }> };
      teammates = config.teammates?.map((t) => t.name) || [];
    } catch (e) {
      console.error('[TeammateBus] Failed to read config:', e);
    }
  }

  // 同步广播给每个队友（除了发送者）
  let count = 0;
  for (const name of teammates) {
    if (name !== sender) {
      send(sender, name, content, msgType);
      count++;
    }
  }

  return `Broadcast to ${count} teammate(s)`;
}

/**
 * 读取并清空指定队友的收件箱（原子操作，防止竞争）
 */
export function readInbox(name: string): string {
  const inboxPath = getInboxPath(name);

  if (!fs.existsSync(inboxPath)) {
    return '[]';
  }

  const tempPath = inboxPath + `.tmp.${crypto.randomUUID()}`;
  const release = syncAcquireLock(inboxPath);

  try {
    // 原子性读取并清空：rename 到临时文件，读取临时文件，然后删除
    fs.renameSync(inboxPath, tempPath);

    const content = fs.readFileSync(tempPath, 'utf-8');
    fs.unlinkSync(tempPath);

    if (!content.trim()) {
      return '[]';
    }

    // 返回 JSON 数组格式
    const messages = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return JSON.stringify(messages);
  } catch (error) {
    // 如果 tempPath 存在，清理它
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // 忽略清理错误
      }
    }
    console.error('[TeammateBus] Failed to read inbox:', error);
    return '[]';
  } finally {
    release();
  }
}

/**
 * 异步读取并清空指定队友的收件箱
 */
export async function readInboxAsync(name: string): Promise<string> {
  const inboxPath = getInboxPath(name);

  if (!fs.existsSync(inboxPath)) {
    return '[]';
  }

  const tempPath = inboxPath + `.tmp.${crypto.randomUUID()}`;
  const release = await acquireLock(inboxPath);

  try {
    // 原子性读取并清空
    await fs.promises.rename(inboxPath, tempPath);

    const content = await fs.promises.readFile(tempPath, 'utf-8');
    await fs.promises.unlink(tempPath);

    if (!content.trim()) {
      return '[]';
    }

    const messages = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return JSON.stringify(messages);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // 忽略清理错误
      }
    }
    console.error('[TeammateBus] Failed to read inbox:', error);
    return '[]';
  } finally {
    release();
  }
}

/**
 * 预览收件箱（不删除）
 */
export function peekInbox(name: string): TeammateMessage[] {
  const inboxPath = getInboxPath(name);

  if (!fs.existsSync(inboxPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(inboxPath, 'utf-8');
    if (!content.trim()) {
      return [];
    }

    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as TeammateMessage[];
  } catch (error) {
    console.error('[TeammateBus] Failed to peek inbox:', error);
    return [];
  }
}

/**
 * 异步预览收件箱（不删除）
 */
export async function peekInboxAsync(name: string): Promise<TeammateMessage[]> {
  const inboxPath = getInboxPath(name);

  if (!fs.existsSync(inboxPath)) {
    return [];
  }

  try {
    const content = await fs.promises.readFile(inboxPath, 'utf-8');
    if (!content.trim()) {
      return [];
    }

    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as TeammateMessage[];
  } catch (error) {
    console.error('[TeammateBus] Failed to peek inbox:', error);
    return [];
  }
}

/**
 * 获取未读消息数量
 */
export function getUnreadCount(name: string): number {
  return peekInbox(name).length;
}

/**
 * 异步获取未读消息数量
 */
export async function getUnreadCountAsync(name: string): Promise<number> {
  return (await peekInboxAsync(name)).length;
}
