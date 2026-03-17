/**
 * Message Queue Worker
 *
 * 自动从队列消费消息并处理
 */

import { messageQueue } from './index.js';
import type { QueuedMessage } from './types.js';

export interface WorkerOptions {
  pollIntervalMs?: number;    // 轮询间隔，默认 1000ms
  maxConcurrent?: number;      // 最大并发处理数，默认 1
  sessionKey?: string;         // 指定 session，不指定则处理所有
}

export interface WorkerProcessor {
  (message: QueuedMessage): Promise<void>;
}

class MessageWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private processor: WorkerProcessor;
  private options: Required<WorkerOptions>;
  private processing = new Set<string>();

  constructor(processor: WorkerProcessor, options: WorkerOptions = {}) {
    this.processor = processor;
    this.options = {
      pollIntervalMs: options.pollIntervalMs || 1000,
      maxConcurrent: options.maxConcurrent || 1,
      sessionKey: options.sessionKey || '',
    };
  }

  /**
   * 启动 Worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Worker] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Worker] Started (poll every ${this.options.pollIntervalMs}ms, max ${this.options.maxConcurrent} concurrent)`);

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.options.pollIntervalMs);
  }

  /**
   * 停止 Worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Worker] Stopped');
  }

  /**
   * 每一轮轮询
   */
  private async tick(): Promise<void> {
    // 检查并发数
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    // 获取下一条待处理消息
    const msg = this.options.sessionKey
      ? messageQueue.dequeue(this.options.sessionKey)
      : messageQueue.dequeue('');

    if (!msg) {
      return;
    }

    // 标记为处理中
    this.processing.add(msg.id);
    console.log(`[Worker] Processing: ${msg.id} - "${msg.content.substring(0, 30)}..."`);

    try {
      // 调用处理器
      await this.processor(msg);

      // 标记完成
      messageQueue.complete(msg.id);
      console.log(`[Worker] Completed: ${msg.id}`);
    } catch (error) {
      console.error(`[Worker] Error processing ${msg.id}:`, error);
      messageQueue.fail(msg.id, String(error));
    } finally {
      this.processing.delete(msg.id);
    }
  }

  /**
   * 获取 Worker 状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processing: this.processing.size,
      maxConcurrent: this.options.maxConcurrent,
      queueStatus: this.options.sessionKey
        ? messageQueue.getStatus(this.options.sessionKey)
        : messageQueue.getAllStatus(),
    };
  }
}

let globalWorker: MessageWorker | null = null;

/**
 * 启动默认 Worker
 */
export function startWorker(processor: WorkerProcessor, options?: WorkerOptions): MessageWorker {
  if (globalWorker) {
    globalWorker.stop();
  }

  globalWorker = new MessageWorker(processor, options);
  globalWorker.start();

  return globalWorker;
}

/**
 * 停止默认 Worker
 */
export function stopWorker(): void {
  if (globalWorker) {
    globalWorker.stop();
    globalWorker = null;
  }
}

/**
 * 获取 Worker 状态
 */
export function getWorkerStatus() {
  if (!globalWorker) {
    return { isRunning: false };
  }
  return globalWorker.getStatus();
}

export { MessageWorker };
