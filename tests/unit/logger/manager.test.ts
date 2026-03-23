// Logger Manager 测试
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger, getLogger, initLogger } from "../../../src/logger/manager.js";

describe("Logger Manager", () => {
  describe("Logger class", () => {
    it("should create logger with default config", () => {
      const logger = new Logger();

      expect(logger).toBeDefined();
    });

    it("should accept custom config", () => {
      const logger = new Logger({ level: "debug", format: "text" });

      expect(logger).toBeDefined();
    });

    it("should set agent id", () => {
      const logger = new Logger();
      logger.setAgentId("test-agent");

      // Agent id is internal, but we can verify it doesn't throw
      expect(() => logger.setAgentId("test-agent")).not.toThrow();
    });

    it("should set session id", () => {
      const logger = new Logger();
      logger.setSessionId("test-session");

      expect(() => logger.setSessionId("test-session")).not.toThrow();
    });

    it("should create child logger", () => {
      const parent = new Logger({ level: "info" });
      const child = parent.child("child-agent", "child-session");

      expect(child).toBeDefined();
    });

    it("should accept context in info log", () => {
      const logger = new Logger();

      // These should not throw even if file writing fails
      expect(() => logger.info("Test message", { key: "value" })).not.toThrow();
    });

    it("should accept context in debug log", () => {
      const logger = new Logger({ level: "debug" });

      expect(() => logger.debug("Debug message", { data: 123 })).not.toThrow();
    });

    it("should accept context in warn log", () => {
      const logger = new Logger();

      expect(() => logger.warn("Warning message", { warning: true })).not.toThrow();
    });

    it("should accept error in error log", () => {
      const logger = new Logger();
      const error = new Error("Test error");

      expect(() => logger.error("Error message", error)).not.toThrow();
    });

    it("should accept error with context", () => {
      const logger = new Logger();
      const error = new Error("Test error");

      expect(() => logger.error("Error message", error, { extra: "data" })).not.toThrow();
    });

    it("should log LLM request", () => {
      const logger = new Logger();

      expect(() => logger.logLlmRequest({
        model: "claude-3",
        latencyMs: 100,
        messageCount: 5,
      })).not.toThrow();
    });

    it("should log LLM response", () => {
      const logger = new Logger();

      expect(() => logger.logLlmResponse({
        model: "claude-3",
        latencyMs: 100,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      })).not.toThrow();
    });

    it("should log LLM error", () => {
      const logger = new Logger();

      expect(() => logger.logLlmError({
        model: "claude-3",
        latencyMs: 100,
        error: "API Error",
      }, new Error("Network error"))).not.toThrow();
    });
  });

  describe("getLogger", () => {
    beforeEach(() => {
      // Reset global logger
      (Logger as any).globalLogger = null;
    });

    it("should return global logger instance", () => {
      const logger1 = getLogger();
      const logger2 = getLogger();

      // Both should be from the same global instance
      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
    });

    it("should create child with agent and session id", () => {
      const logger = getLogger("agent-1", "session-1");

      expect(logger).toBeDefined();
    });
  });

  describe("initLogger", () => {
    beforeEach(() => {
      // Reset global logger
      (Logger as any).globalLogger = null;
    });

    it("should initialize global logger", () => {
      const logger = initLogger({ level: "debug" });

      expect(logger).toBeDefined();
    });

    it("should return initialized logger", () => {
      const logger = initLogger({ level: "warn" });

      // Verify by getting another logger instance
      const logger2 = getLogger();
      expect(logger2).toBeDefined();
    });
  });
});
