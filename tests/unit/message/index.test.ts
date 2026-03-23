// Message Queue 测试
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { messageQueue } from "../../../src/message/index.js";

describe("Message Queue", () => {
  beforeEach(() => {
    messageQueue.clear();
  });

  afterEach(() => {
    messageQueue.clear();
  });

  describe("enqueue", () => {
    it("should enqueue a message", () => {
      const result = messageQueue.enqueue("session-1", "Hello world");

      expect(result.message_id).toBeDefined();
      expect(result.status).toBe("queued");
      expect(result.queue_status.total).toBe(1);
      expect(result.queue_status.pending).toBe(1);
    });

    it("should handle multiple messages in same session", () => {
      messageQueue.enqueue("session-1", "Message 1");
      messageQueue.enqueue("session-1", "Message 2");

      const status = messageQueue.getStatus("session-1");
      expect(status.total).toBe(2);
      expect(status.pending).toBe(2);
    });

    it("should handle multiple sessions", () => {
      messageQueue.enqueue("session-1", "Msg 1");
      messageQueue.enqueue("session-2", "Msg 2");

      expect(messageQueue.size("session-1")).toBe(1);
      expect(messageQueue.size("session-2")).toBe(1);
    });
  });

  describe("peek", () => {
    it("should peek at next pending message", () => {
      messageQueue.enqueue("session-1", "Hello");
      const msg = messageQueue.peek("session-1");

      expect(msg).not.toBeNull();
      expect(msg?.content).toBe("Hello");
      expect(msg?.status).toBe("pending");
    });

    it("should return null for empty queue", () => {
      const msg = messageQueue.peek("empty-session");
      expect(msg).toBeNull();
    });

    it("should skip completed messages", () => {
      const result = messageQueue.enqueue("session-1", "Hello");
      messageQueue.dequeue("session-1");
      messageQueue.complete(result.message_id);

      const msg = messageQueue.peek("session-1");
      expect(msg).toBeNull();
    });
  });

  describe("dequeue", () => {
    it("should dequeue and mark as processing", () => {
      messageQueue.enqueue("session-1", "Hello");
      const msg = messageQueue.dequeue("session-1");

      expect(msg).not.toBeNull();
      expect(msg?.content).toBe("Hello");
      expect(msg?.status).toBe("processing");

      const status = messageQueue.getStatus("session-1");
      expect(status.processing).toBe(1);
      expect(status.pending).toBe(0);
    });

    it("should return null when no pending messages", () => {
      const msg = messageQueue.dequeue("empty-session");
      expect(msg).toBeNull();
    });

    it("should process messages in order", () => {
      messageQueue.enqueue("session-1", "First");
      messageQueue.enqueue("session-1", "Second");

      const first = messageQueue.dequeue("session-1");
      const second = messageQueue.dequeue("session-1");

      expect(first?.content).toBe("First");
      expect(second?.content).toBe("Second");
    });
  });

  describe("complete", () => {
    it("should mark message as completed", () => {
      const result = messageQueue.enqueue("session-1", "Hello");
      messageQueue.dequeue("session-1");
      messageQueue.complete(result.message_id);

      const status = messageQueue.getStatus("session-1");
      expect(status.completed).toBe(1);
      expect(status.processing).toBe(0);
    });

    it("should return completed message", () => {
      const result = messageQueue.enqueue("session-1", "Hello");
      messageQueue.dequeue("session-1");
      const completed = messageQueue.complete(result.message_id);

      expect(completed?.id).toBe(result.message_id);
      expect(completed?.status).toBe("completed");
    });

    it("should return null for non-existent message", () => {
      const result = messageQueue.complete("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("fail", () => {
    it("should mark message as failed with error", () => {
      const result = messageQueue.enqueue("session-1", "Hello");
      messageQueue.dequeue("session-1");
      const failed = messageQueue.fail(result.message_id, "Test error");

      expect(failed?.status).toBe("completed");
      expect((failed as any)?.error).toBe("Test error");
    });
  });

  describe("getStatus", () => {
    it("should return queue status", () => {
      const result1 = messageQueue.enqueue("session-1", "Msg1");
      messageQueue.enqueue("session-1", "Msg2");
      messageQueue.dequeue("session-1");
      messageQueue.complete(result1.message_id);

      const status = messageQueue.getStatus("session-1");
      expect(status.total).toBe(2);
      expect(status.pending).toBe(1);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(1);
    });

    it("should return zero for empty session", () => {
      const status = messageQueue.getStatus("empty-session");
      expect(status.total).toBe(0);
      expect(status.pending).toBe(0);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(0);
    });
  });

  describe("getAllStatus", () => {
    it("should return status for all sessions", () => {
      messageQueue.enqueue("session-1", "Msg1");
      messageQueue.enqueue("session-2", "Msg2");

      const allStatus = messageQueue.getAllStatus();
      expect(allStatus["session-1"]).toBeDefined();
      expect(allStatus["session-2"]).toBeDefined();
    });

    it("should return empty object when no sessions", () => {
      const allStatus = messageQueue.getAllStatus();
      expect(Object.keys(allStatus).length).toBe(0);
    });
  });

  describe("getNextPending", () => {
    it("should get next pending message for specific session", () => {
      messageQueue.enqueue("session-1", "First");
      messageQueue.enqueue("session-1", "Second");

      const msg = messageQueue.getNextPending("session-1");
      expect(msg?.content).toBe("First");
    });

    it("should get next pending message globally", () => {
      messageQueue.enqueue("session-1", "Msg1");
      messageQueue.enqueue("session-2", "Msg2");

      const msg = messageQueue.getNextPending();
      expect(msg).not.toBeNull();
    });

    it("should return null when no pending", () => {
      const msg = messageQueue.getNextPending("empty");
      expect(msg).toBeNull();
    });
  });

  describe("clear", () => {
    it("should clear specific session queue", () => {
      messageQueue.enqueue("session-1", "Msg1");
      messageQueue.enqueue("session-1", "Msg2");
      messageQueue.enqueue("session-2", "Msg3");

      messageQueue.clear("session-1");

      expect(messageQueue.size("session-1")).toBe(0);
      expect(messageQueue.size("session-2")).toBe(1);
    });

    it("should clear all queues when no sessionKey", () => {
      messageQueue.enqueue("session-1", "Msg1");
      messageQueue.enqueue("session-2", "Msg2");

      messageQueue.clear();

      expect(messageQueue.size("session-1")).toBe(0);
      expect(messageQueue.size("session-2")).toBe(0);
    });
  });

  describe("size", () => {
    it("should return queue size", () => {
      messageQueue.enqueue("session-1", "Msg1");
      messageQueue.enqueue("session-1", "Msg2");

      expect(messageQueue.size("session-1")).toBe(2);
    });

    it("should return 0 for non-existent session", () => {
      expect(messageQueue.size("non-existent")).toBe(0);
    });
  });

  describe("getPending", () => {
    it("should return all pending messages", () => {
      messageQueue.enqueue("session-1", "Msg1");
      messageQueue.enqueue("session-1", "Msg2");
      messageQueue.dequeue("session-1");

      const pending = messageQueue.getPending("session-1");
      expect(pending.length).toBe(1);
      expect(pending[0].content).toBe("Msg2");
    });

    it("should return empty array for non-existent session", () => {
      const pending = messageQueue.getPending("empty");
      expect(pending).toEqual([]);
    });
  });
});
