/**
 * MessageBus - 队友消息总线
 *
 * 实现 JSONL 邮箱的读写：
 * 1. 发送消息到指定队友的收件箱
 * 2. 广播消息给所有队友
 * 3. 读取指定队友的收件箱
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

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
 * 发送消息到指定队友的收件箱
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
  fs.appendFileSync(inboxPath, line, 'utf-8');

  return `Message sent to ${to}`;
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

  // 广播给每个队友（除了发送者）
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
 * 读取并清空指定队友的收件箱
 */
export function readInbox(name: string): string {
  const inboxPath = getInboxPath(name);

  if (!fs.existsSync(inboxPath)) {
    return '[]';
  }

  try {
    const content = fs.readFileSync(inboxPath, 'utf-8');
    if (!content.trim()) {
      return '[]';
    }

    // 读取后清空收件箱
    fs.writeFileSync(inboxPath, '', 'utf-8');

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
    console.error('[TeammateBus] Failed to read inbox:', error);
    return '[]';
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
 * 获取未读消息数量
 */
export function getUnreadCount(name: string): number {
  return peekInbox(name).length;
}
