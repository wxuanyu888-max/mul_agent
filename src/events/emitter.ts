/**
 * Events - 事件通知系统
 *
 * 支持 Agent 间的事件通信：
 * - 事件订阅
 * - 事件发布
 * - 事件过滤
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const getStorageDir = (): string => {
  if (process.env.EVENTS_DIR) {
    return process.env.EVENTS_DIR;
  }
  return path.join(process.cwd(), 'storage', 'events');
};

/**
 * 事件类型
 */
export type EventType =
  | 'task.completed'
  | 'task.failed'
  | 'task.created'
  | 'member.joined'
  | 'member.left'
  | 'member.idle'
  | 'message.received'
  | 'delegation.completed'
  | 'delegation.rejected';

/**
 * 事件数据
 */
export interface Event {
  id: string;
  type: EventType;
  source: string;
  target?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * 订阅者
 */
interface Subscriber {
  agent: string;
  events: EventType[];
  callback: (event: Event) => void;
}

/**
 * 事件发射器
 */
class EventEmitter {
  private static instance: EventEmitter;
  private subscribers: Map<string, Subscriber[]> = new Map();
  private eventLog: Event[] = [];
  private maxLogSize: number = 1000;

  private constructor() {
    ensureStorageDir();
  }

  static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  /**
   * 订阅事件
   */
  subscribe(agent: string, events: EventType[], callback: (event: Event) => void): void {
    const existing = this.subscribers.get(agent) || [];
    existing.push({ agent, events, callback });
    this.subscribers.set(agent, existing);
  }

  /**
   * 取消订阅
   */
  unsubscribe(agent: string): void {
    this.subscribers.delete(agent);
  }

  /**
   * 获取订阅的事件类型
   */
  getSubscribedEvents(agent: string): EventType[] {
    const subs = this.subscribers.get(agent) || [];
    return subs.flatMap(s => s.events);
  }

  /**
   * 发布事件
   */
  emit(type: EventType, source: string, data: Record<string, unknown> = {}, target?: string): Event {
    const event: Event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      source,
      target,
      data,
      timestamp: Date.now(),
    };

    // 记录事件
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    // 持久化
    this.persistEvent(event);

    // 通知订阅者
    this.notifySubscribers(event);

    return event;
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(event: Event): void {
    for (const [, subs] of this.subscribers) {
      for (const sub of subs) {
        // 检查是否订阅了这个事件类型
        if (sub.events.includes(event.type)) {
          // 检查目标匹配（如果没有指定目标，则广播给所有人）
          if (!event.target || event.target === sub.agent || event.source === sub.agent) {
            try {
              sub.callback(event);
            } catch (error) {
              console.error(`[EventEmitter] Callback error for ${sub.agent}:`, error);
            }
          }
        }
      }
    }
  }

  /**
   * 持久化事件
   */
  private persistEvent(event: Event): void {
    const dir = path.join(getStorageDir(), 'log');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const date = new Date(event.timestamp).toISOString().split('T')[0];
    const filePath = path.join(dir, `${date}.jsonl`);

    fs.appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf-8');
  }

  /**
   * 获取事件历史
   */
  getHistory(type?: EventType, limit: number = 50): Event[] {
    let events = this.eventLog;

    if (type) {
      events = events.filter(e => e.type === type);
    }

    return events.slice(-limit).reverse();
  }

  /**
   * 获取特定 source 的事件
   */
  getBySource(source: string, limit: number = 20): Event[] {
    return this.eventLog
      .filter(e => e.source === source)
      .slice(-limit)
      .reverse();
  }

  /**
   * 获取特定 target 的事件
   */
  getByTarget(target: string, limit: number = 20): Event[] {
    return this.eventLog
      .filter(e => e.target === target || !e.target)
      .slice(-limit)
      .reverse();
  }

  /**
   * 清理旧事件（保留最近 N 天）
   */
  cleanup(daysToKeep: number = 7): number {
    const dir = path.join(getStorageDir(), 'log');
    if (!fs.existsSync(dir)) {
      return 0;
    }

    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(dir);
    let count = 0;

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        count++;
      }
    }

    return count;
  }
}

/**
 * 确保存储目录存在
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(getStorageDir())) {
    fs.mkdirSync(getStorageDir(), { recursive: true });
  }
}

/**
 * 获取事件发射器
 */
export function getEventEmitter(): EventEmitter {
  return EventEmitter.getInstance();
}

// 便捷函数

export function emitEvent(type: EventType, source: string, data?: Record<string, unknown>, target?: string): Event {
  return getEventEmitter().emit(type, source, data, target);
}

export function subscribeToEvents(agent: string, events: EventType[], callback: (event: Event) => void): void {
  getEventEmitter().subscribe(agent, events, callback);
}

export function unsubscribeFromEvents(agent: string): void {
  getEventEmitter().unsubscribe(agent);
}

export function getEventHistory(type?: EventType, limit?: number): Event[] {
  return getEventEmitter().getHistory(type, limit);
}

// 预定义的事件发射辅助函数
export function emitTaskCompleted(taskId: number, owner: string, result?: string): Event {
  return emitEvent('task.completed', owner, { taskId, result });
}

export function emitTaskFailed(taskId: number, owner: string, error: string): Event {
  return emitEvent('task.failed', owner, { taskId, error });
}

export function emitMemberJoined(agent: string, role: string): Event {
  return emitEvent('member.joined', agent, { role });
}

export function emitMemberLeft(agent: string): Event {
  return emitEvent('member.left', agent);
}

export function emitDelegationCompleted(delegationId: string, from: string, to: string, result: string): Event {
  return emitEvent('delegation.completed', to, { delegationId, from, result }, from);
}
