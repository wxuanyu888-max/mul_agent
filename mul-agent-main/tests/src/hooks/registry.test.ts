// HookRegistry 测试
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HookRegistry } from "../../../src/hooks/registry.js";

describe("HookRegistry", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe("register", () => {
    it("should register a hook handler", () => {
      const handler = vi.fn();

      registry.register({
        event: "agent.start",
        handler,
      });

      const handlers = registry.getHandlers("agent.start");
      expect(handlers).toHaveLength(1);
      expect(handlers[0].handler).toBe(handler);
    });

    it("should register multiple handlers for same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register({ event: "agent.start", handler: handler1 });
      registry.register({ event: "agent.start", handler: handler2 });

      const handlers = registry.getHandlers("agent.start");
      expect(handlers).toHaveLength(2);
    });

    it("should sort handlers by priority (higher first)", () => {
      const lowPriority = vi.fn();
      const highPriority = vi.fn();

      registry.register({ event: "agent.start", handler: lowPriority, priority: 1 });
      registry.register({ event: "agent.start", handler: highPriority, priority: 10 });

      const handlers = registry.getHandlers("agent.start");
      expect(handlers[0].priority).toBe(10);
      expect(handlers[1].priority).toBe(1);
    });

    it("should use default priority of 0", () => {
      const handler = vi.fn();

      registry.register({ event: "agent.start", handler });

      const handlers = registry.getHandlers("agent.start");
      expect(handlers[0].priority).toBe(0);
    });
  });

  describe("unregister", () => {
    it("should remove a specific handler", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register({ event: "agent.start", handler: handler1 });
      registry.register({ event: "agent.start", handler: handler2 });

      registry.unregister("agent.start", handler1);

      const handlers = registry.getHandlers("agent.start");
      expect(handlers).toHaveLength(1);
      expect(handlers[0].handler).toBe(handler2);
    });
  });

  describe("getHandlers", () => {
    it("should return empty array for unregistered event", () => {
      const handlers = registry.getHandlers("agent.start");
      expect(handlers).toEqual([]);
    });

    it("should return all handlers for an event", () => {
      registry.register({ event: "message.received", handler: vi.fn() });
      registry.register({ event: "message.received", handler: vi.fn() });

      const handlers = registry.getHandlers("message.received");
      expect(handlers).toHaveLength(2);
    });
  });

  describe("getEventTypes", () => {
    it("should return all registered event types", () => {
      registry.register({ event: "agent.start", handler: vi.fn() });
      registry.register({ event: "agent.end", handler: vi.fn() });
      registry.register({ event: "message.received", handler: vi.fn() });

      const eventTypes = registry.getEventTypes();

      expect(eventTypes).toContain("agent.start");
      expect(eventTypes).toContain("agent.end");
      expect(eventTypes).toContain("message.received");
    });
  });

  describe("clear", () => {
    it("should remove all handlers", () => {
      registry.register({ event: "agent.start", handler: vi.fn() });
      registry.register({ event: "agent.end", handler: vi.fn() });

      registry.clear();

      expect(registry.getEventTypes()).toHaveLength(0);
    });
  });

  describe("clearEvent", () => {
    it("should remove all handlers for specific event", () => {
      registry.register({ event: "agent.start", handler: vi.fn() });
      registry.register({ event: "agent.start", handler: vi.fn() });
      registry.register({ event: "agent.end", handler: vi.fn() });

      registry.clearEvent("agent.start");

      expect(registry.getHandlers("agent.start")).toHaveLength(0);
      expect(registry.getHandlers("agent.end")).toHaveLength(1);
    });
  });

  describe("hasHandlers", () => {
    it("should return true when event has handlers", () => {
      registry.register({ event: "agent.start", handler: vi.fn() });

      expect(registry.hasHandlers("agent.start")).toBe(true);
    });

    it("should return false when event has no handlers", () => {
      expect(registry.hasHandlers("agent.start")).toBe(false);
    });
  });
});
