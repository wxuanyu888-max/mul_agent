// HookExecutor 测试
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HookExecutor, HookRegistry } from "../../../src/hooks/registry.js";

describe("HookExecutor", () => {
  let executor: HookExecutor;
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
    executor = new HookExecutor({ registry, continueOnError: true });
  });

  describe("emit", () => {
    it("should call registered handlers when event is emitted", async () => {
      const handler = vi.fn();

      registry.register({
        event: "agent.start",
        handler,
      });

      await executor.emit("agent.start", { sessionId: "test-session" });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("agent.start");
      expect(event.context.sessionId).toBe("test-session");
    });

    it("should not call disabled handlers", async () => {
      const handler = vi.fn();

      registry.register({
        event: "agent.start",
        handler,
        enabled: false,
      });

      await executor.emit("agent.start", {});

      expect(handler).not.toHaveBeenCalled();
    });

    it("should call handlers in priority order", async () => {
      const order: string[] = [];

      registry.register({
        event: "agent.start",
        handler: () => order.push("low"),
        priority: 1,
      });
      registry.register({
        event: "agent.start",
        handler: () => order.push("high"),
        priority: 10,
      });

      await executor.emit("agent.start", {});

      expect(order).toEqual(["high", "low"]);
    });

    it("should continue on error when continueOnError is true", async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error("Handler error"));
      const successHandler = vi.fn();

      registry.register({ event: "agent.start", handler: errorHandler });
      registry.register({ event: "agent.start", handler: successHandler });

      // Should not throw
      await executor.emit("agent.start", {});

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it("should throw error when continueOnError is false", async () => {
      const errorExecutor = new HookExecutor({ registry, continueOnError: false });
      const errorHandler = vi.fn().mockRejectedValue(new Error("Handler error"));

      registry.register({ event: "agent.start", handler: errorHandler });

      await expect(errorExecutor.emit("agent.start", {})).rejects.toThrow("Handler error");
    });

    it("should handle events with no handlers gracefully", async () => {
      await executor.emit("agent.start", {});
      // Should not throw
    });

    it("should add timestamp to context", async () => {
      const handler = vi.fn();
      const beforeTime = Date.now();

      registry.register({ event: "agent.start", handler });

      await executor.emit("agent.start", {});

      const afterTime = Date.now();
      const event = handler.mock.calls[0][0];

      expect(event.context.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(event.context.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should merge provided context with defaults", async () => {
      const handler = vi.fn();

      registry.register({ event: "session.start", handler });

      await executor.emit("session.start", {
        sessionId: "my-session",
        userId: "user-123",
        data: { key: "value" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.context.sessionId).toBe("my-session");
      expect(event.context.userId).toBe("user-123");
      expect(event.context.data).toEqual({ key: "value" });
    });
  });

  describe("withContext", () => {
    it("should create new executor with pre-filled context", async () => {
      const handler = vi.fn();

      registry.register({ event: "agent.start", handler });

      const contextExecutor = executor.withContext({
        sessionId: "preset-session",
      });

      await contextExecutor.emit("agent.start", {});

      const event = handler.mock.calls[0][0];
      expect(event.context.sessionId).toBe("preset-session");
    });
  });
});
