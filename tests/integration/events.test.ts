// Event System 单元测试 - T-007
import { describe, it, expect, beforeEach } from "vitest";
import path from 'path';
import fs from 'fs';

describe("Event System (T-007)", () => {
  const testDir = path.join(process.cwd(), 'storage', 'events-test');

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        const filePath = path.join(testDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          const subFiles = fs.readdirSync(filePath);
          for (const subFile of subFiles) {
            fs.unlinkSync(path.join(filePath, subFile));
          }
          fs.rmdirSync(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(testDir);
    }

    // 设置临时目录
    process.env.EVENTS_DIR = testDir;
  });

  it("should export event functions", async () => {
    const {
      getEventEmitter,
      emitEvent,
      subscribeToEvents,
      unsubscribeFromEvents,
      getEventHistory,
      emitTaskCompleted,
      emitTaskFailed,
    } = await import("../../src/events/emitter.js");

    expect(typeof getEventEmitter).toBe('function');
    expect(typeof emitEvent).toBe('function');
    expect(typeof subscribeToEvents).toBe('function');
    expect(typeof unsubscribeFromEvents).toBe('function');
    expect(typeof getEventHistory).toBe('function');
    expect(typeof emitTaskCompleted).toBe('function');
    expect(typeof emitTaskFailed).toBe('function');
  });

  it("should emit and subscribe to events", async () => {
    const { getEventEmitter } = await import("../../src/events/emitter.js");
    const emitter = getEventEmitter();

    let received = false;
    let receivedEvent: any = null;

    emitter.subscribe('agent1', ['task.completed'], (evt) => {
      received = true;
      receivedEvent = evt;
    });

    const event = emitter.emit('task.completed', 'agent2', { taskId: 1, result: 'done' });

    expect(received).toBe(true);
    expect(receivedEvent.type).toBe('task.completed');
    expect(receivedEvent.source).toBe('agent2');
    expect(receivedEvent.data.taskId).toBe(1);
  });

  it("should filter by event type", async () => {
    const { getEventEmitter } = await import("../../src/events/emitter.js");
    const emitter = getEventEmitter();

    const beforeCount = emitter.getHistory().length;
    emitter.emit('task.completed', 'a', {});
    emitter.emit('task.completed', 'a', {});
    emitter.emit('task.failed', 'a', {});

    const history = emitter.getHistory('task.completed');
    expect(history.length).toBe(beforeCount + 2);
  });

  it("should support multiple subscribers", async () => {
    const { getEventEmitter } = await import("../../src/events/emitter.js");
    const emitter = getEventEmitter();

    let count1 = 0;
    let count2 = 0;

    emitter.subscribe('agent1', ['task.completed'], () => count1++);
    emitter.subscribe('agent2', ['task.completed'], () => count2++);

    emitter.emit('task.completed', 'agent1', {});

    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it("should unsubscribe", async () => {
    const { getEventEmitter } = await import("../../src/events/emitter.js");
    const emitter = getEventEmitter();

    let count = 0;
    const callback = () => count++;

    emitter.subscribe('agent1', ['task.completed'], callback);
    emitter.emit('task.completed', 'agent1', {});

    expect(count).toBe(1);

    emitter.unsubscribe('agent1');
    emitter.emit('task.completed', 'agent1', {});

    expect(count).toBe(1); // 应该还是 1，因为已经取消订阅
  });

  it("should get history by source", async () => {
    const { getEventEmitter } = await import("../../src/events/emitter.js");
    const emitter = getEventEmitter();

    emitter.emit('task.completed', 'agent1', {});
    emitter.emit('task.failed', 'agent2', {});
    emitter.emit('task.completed', 'agent1', {});

    const bySource = emitter.getBySource('agent1');
    expect(bySource.length).toBeGreaterThanOrEqual(2);
  });

  it("should get history by target", async () => {
    const { getEventEmitter } = await import("../../src/events/emitter.js");
    const emitter = getEventEmitter();

    emitter.emit('task.completed', 'agent1', {}, 'agent2');
    emitter.emit('task.completed', 'agent1', {}, 'agent3');
    emitter.emit('task.completed', 'agent1', {}); // 没有 target (广播)

    // 会返回指定 target 的 + 广播事件
    const byTarget = emitter.getByTarget('agent2');
    expect(byTarget.length).toBeGreaterThanOrEqual(1);
  });

  it("should emit task completed helper", async () => {
    const { emitTaskCompleted } = await import("../../src/events/emitter.js");
    const event = emitTaskCompleted(1, 'agent1', 'success');

    expect(event.type).toBe('task.completed');
    expect(event.source).toBe('agent1');
    expect(event.data.taskId).toBe(1);
    expect(event.data.result).toBe('success');
  });

  it("should emit task failed helper", async () => {
    const { emitTaskFailed } = await import("../../src/events/emitter.js");
    const event = emitTaskFailed(1, 'agent1', 'error message');

    expect(event.type).toBe('task.failed');
    expect(event.source).toBe('agent1');
    expect(event.data.taskId).toBe(1);
    expect(event.data.error).toBe('error message');
  });

  it("should limit history size", async () => {
    const { getEventEmitter } = await import("../../src/events/emitter.js");
    const emitter = getEventEmitter();

    // 发射很多事件
    for (let i = 0; i < 100; i++) {
      emitter.emit('task.completed', 'agent1', { id: i });
    }

    const history = emitter.getHistory();
    expect(history.length).toBeLessThanOrEqual(100); // 应该被限制
  });
});
