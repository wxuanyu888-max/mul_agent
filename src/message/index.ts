/**
 * Message Queue
 *
 * 用户消息的缓冲池，支持非阻塞输入
 */

import type { QueuedMessage, QueueStatus, EnqueueResult } from './types.js';

// 每个session一个队列
const queues: Map<string, QueuedMessage[]> = new Map();

// Helper function
function getQueueStatus(sessionKey: string): QueueStatus {
  const queue = queues.get(sessionKey) || [];
  return {
    pending: queue.filter(m => m.status === 'pending').length,
    processing: queue.filter(m => m.status === 'processing').length,
    completed: queue.filter(m => m.status === 'completed').length,
    total: queue.length
  };
}

function generateId(): string {
  return crypto.randomUUID();
}

export const messageQueue = {
  /**
   * 添加消息到队列
   */
  enqueue(sessionKey: string, content: string): EnqueueResult {
    const queue = queues.get(sessionKey) || [];
    const msg: QueuedMessage = {
      id: generateId(),
      sessionKey,
      content,
      timestamp: Date.now(),
      status: 'pending'
    };
    queue.push(msg);
    queues.set(sessionKey, queue);

    return {
      message_id: msg.id,
      status: 'queued',
      queue_status: getQueueStatus(sessionKey)
    };
  },

  /**
   * 获取下一条待处理消息（不改变状态）
   */
  peek(sessionKey: string): QueuedMessage | null {
    const queue = queues.get(sessionKey);
    if (!queue || queue.length === 0) return null;
    return queue.find(m => m.status === 'pending') || null;
  },

  /**
   * 获取并标记为处理中
   */
  dequeue(sessionKey: string): QueuedMessage | null {
    const queue = queues.get(sessionKey);
    if (!queue || queue.length === 0) return null;

    const msg = queue.find(m => m.status === 'pending');
    if (msg) {
      msg.status = 'processing';
    }
    return msg || null;
  },

  /**
   * 标记消息完成
   */
  complete(messageId: string): QueuedMessage | null {
    for (const queue of queues.values()) {
      const msg = queue.find(m => m.id === messageId);
      if (msg) {
        msg.status = 'completed';
        return msg;
      }
    }
    return null;
  },

  /**
   * 标记消息失败
   */
  fail(messageId: string, error?: string): QueuedMessage | null {
    for (const queue of queues.values()) {
      const msg = queue.find(m => m.id === messageId);
      if (msg) {
        msg.status = 'completed'; // 也标记完成，只是有error
        (msg as any).error = error;
        return msg;
      }
    }
    return null;
  },

  /**
   * 获取队列状态
   */
  getStatus(sessionKey: string): QueueStatus {
    const queue = queues.get(sessionKey) || [];
    return {
      pending: queue.filter(m => m.status === 'pending').length,
      processing: queue.filter(m => m.status === 'processing').length,
      completed: queue.filter(m => m.status === 'completed').length,
      total: queue.length
    };
  },

  /**
   * 获取所有队列状态
   */
  getAllStatus(): Record<string, QueueStatus> {
    const status: Record<string, QueueStatus> = {};
    for (const [sessionKey, queue] of queues.entries()) {
      status[sessionKey] = {
        pending: queue.filter(m => m.status === 'pending').length,
        processing: queue.filter(m => m.status === 'processing').length,
        completed: queue.filter(m => m.status === 'completed').length,
        total: queue.length
      };
    }
    return status;
  },

  /**
   * 获取下一条待处理消息（按时间顺序）
   */
  getNextPending(sessionKey?: string): QueuedMessage | null {
    if (sessionKey) {
      const queue = queues.get(sessionKey);
      if (!queue) return null;
      const pending = queue
        .filter(m => m.status === 'pending')
        .sort((a, b) => a.timestamp - b.timestamp);
      return pending[0] || null;
    } else {
      // 全局找最早的消息
      let earliest: QueuedMessage | null = null;
      for (const queue of queues.values()) {
        const pending = queue
          .filter(m => m.status === 'pending')
          .sort((a, b) => a.timestamp - b.timestamp);
        if (pending[0] && (!earliest || pending[0].timestamp < earliest.timestamp)) {
          earliest = pending[0];
        }
      }
      return earliest;
    }
  },

  /**
   * 清空队列
   */
  clear(sessionKey?: string): void {
    if (sessionKey) {
      queues.delete(sessionKey);
    } else {
      queues.clear();
    }
  },

  /**
   * 获取队列长度
   */
  size(sessionKey: string): number {
    return queues.get(sessionKey)?.length || 0;
  },

  /**
   * 获取所有待处理消息
   */
  getPending(sessionKey: string): QueuedMessage[] {
    const queue = queues.get(sessionKey);
    return queue?.filter(m => m.status === 'pending') || [];
  }
};

// Worker exports
export { MessageWorker, startWorker, stopWorker, getWorkerStatus } from './worker.js';

export default messageQueue;
