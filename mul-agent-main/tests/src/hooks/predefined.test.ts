// Predefined Hooks 测试
import { describe, it, expect, vi } from "vitest";
import {
  createHookHandler,
  createLoggingHook,
  createMetricsHook,
  createErrorHandlerHook,
  createSessionStartHook,
  createSessionEndHook,
  createMessageReceivedHook,
  createBeforeToolHook,
  createAfterToolHook,
} from "../../../src/hooks/predefined.js";
import type { HookEvent, HookEventType } from "../../../src/hooks/types.js";

describe("Predefined Hooks", () => {
  const createMockEvent = (overrides: Partial<HookEvent> = {}): HookEvent => ({
    type: "agent.start" as HookEventType,
    source: "test",
    context: {
      timestamp: Date.now(),
      sessionId: "test-session",
    },
    timestamp: Date.now(),
    ...overrides,
  });

  describe("createHookHandler", () => {
    it("should create a hook handler with event type", () => {
      const handler = vi.fn();
      const hook = createHookHandler("agent.start", handler);

      expect(hook.event).toBe("agent.start");
      expect(hook.handler).toBe(handler);
    });

    it("should set default priority to 0", () => {
      const hook = createHookHandler("agent.start", vi.fn());
      expect(hook.priority).toBe(0);
    });

    it("should accept custom priority", () => {
      const hook = createHookHandler("agent.start", vi.fn(), { priority: 100 });
      expect(hook.priority).toBe(100);
    });

    it("should default enabled to true", () => {
      const hook = createHookHandler("agent.start", vi.fn());
      expect(hook.enabled).toBe(true);
    });
  });

  describe("createLoggingHook", () => {
    it("should create a logging hook with low priority", () => {
      const hook = createLoggingHook("agent.start");

      expect(hook.event).toBe("agent.start");
      expect(hook.priority).toBe(-100);
    });

    it("should execute handler without error", async () => {
      const hook = createLoggingHook("agent.start");
      const event = createMockEvent();

      await expect(hook.handler(event)).resolves.not.toThrow();
    });
  });

  describe("createMetricsHook", () => {
    it("should create a metrics hook with very low priority", () => {
      const hook = createMetricsHook("agent.start");

      expect(hook.event).toBe("agent.start");
      expect(hook.priority).toBe(-200);
    });
  });

  describe("createErrorHandlerHook", () => {
    it("should bind to agent.error event", () => {
      const hook = createErrorHandlerHook();
      expect(hook.event).toBe("agent.error");
    });

    it("should have high priority", () => {
      const hook = createErrorHandlerHook();
      expect(hook.priority).toBe(100);
    });
  });

  describe("createSessionStartHook", () => {
    it("should bind to session.start event", () => {
      const hook = createSessionStartHook(vi.fn());
      expect(hook.event).toBe("session.start");
    });

    it("should call handler with sessionId and userId", async () => {
      const handler = vi.fn();
      const hook = createSessionStartHook(handler);
      const event = createMockEvent({
        type: "session.start",
        context: {
          timestamp: Date.now(),
          sessionId: "session-123",
          userId: "user-456",
        },
      });

      await hook.handler(event);

      expect(handler).toHaveBeenCalledWith("session-123", "user-456");
    });
  });

  describe("createSessionEndHook", () => {
    it("should bind to session.end event", () => {
      const hook = createSessionEndHook(vi.fn());
      expect(hook.event).toBe("session.end");
    });

    it("should call handler with sessionId and messageCount", async () => {
      const handler = vi.fn();
      const hook = createSessionEndHook(handler);
      const event = createMockEvent({
        type: "session.end",
        context: {
          timestamp: Date.now(),
          sessionId: "session-123",
          data: { messageCount: 42 },
        },
      });

      await hook.handler(event);

      expect(handler).toHaveBeenCalledWith("session-123", 42);
    });
  });

  describe("createMessageReceivedHook", () => {
    it("should bind to message.received event", () => {
      const hook = createMessageReceivedHook(vi.fn());
      expect(hook.event).toBe("message.received");
    });

    it("should call handler with message and context", async () => {
      const handler = vi.fn();
      const hook = createMessageReceivedHook(handler);
      const event = createMockEvent({
        type: "message.received",
        context: {
          timestamp: Date.now(),
          sessionId: "session-1",
          data: { message: "Hello world" },
        },
      });

      await hook.handler(event);

      expect(handler).toHaveBeenCalledWith("Hello world", event.context);
    });
  });

  describe("createBeforeToolHook", () => {
    it("should bind to tool.before_call event", () => {
      const hook = createBeforeToolHook(vi.fn());
      expect(hook.event).toBe("tool.before_call");
    });

    it("should call handler with toolName and params", async () => {
      const handler = vi.fn();
      const hook = createBeforeToolHook(handler);
      const event = createMockEvent({
        type: "tool.before_call",
        context: {
          timestamp: Date.now(),
          data: { toolName: "read_file", params: { path: "/test" } },
        },
      });

      await hook.handler(event);

      expect(handler).toHaveBeenCalledWith("read_file", { path: "/test" });
    });
  });

  describe("createAfterToolHook", () => {
    it("should bind to tool.after_call event", () => {
      const hook = createAfterToolHook(vi.fn());
      expect(hook.event).toBe("tool.after_call");
    });

    it("should call handler with toolName and result", async () => {
      const handler = vi.fn();
      const hook = createAfterToolHook(handler);
      const event = createMockEvent({
        type: "tool.after_call",
        context: {
          timestamp: Date.now(),
          data: { toolName: "read_file", result: { content: "file content" } },
        },
      });

      await hook.handler(event);

      expect(handler).toHaveBeenCalledWith("read_file", { content: "file content" });
    });
  });
});
