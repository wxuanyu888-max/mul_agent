// Retry 模块测试
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRetry,
  createRetryableFn,
  createRetryState,
  DEFAULT_RETRY_CONFIG,
} from "../../../src/agents/retry.js";

describe("Retry Module", () => {
  describe("DEFAULT_RETRY_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.retryableErrors).toBeDefined();
      expect(DEFAULT_RETRY_CONFIG.retryableErrors).toContain("ECONNRESET");
      expect(DEFAULT_RETRY_CONFIG.retryableErrors).toContain("rate_limit");
    });
  });

  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, {
        config: { maxAttempts: 3, initialDelayMs: 10 }
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should throw after max attempts", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Permanent error"));

      await expect(withRetry(fn, {
        config: { maxAttempts: 3, initialDelayMs: 10 }
      })).rejects.toThrow("Permanent error");
    });

    it("should not retry non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Invalid input"));

      await expect(withRetry(fn, {
        config: { maxAttempts: 3, initialDelayMs: 10 }
      })).rejects.toThrow("Invalid input");

      // 只调用一次，因为第一个错误不可重试
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should call onAttempt callback on each failure", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
      const onAttempt = vi.fn();

      await expect(withRetry(fn, {
        config: { maxAttempts: 3, initialDelayMs: 10 },
        onAttempt
      })).rejects.toThrow();

      // onAttempt 在每次失败时调用
      expect(onAttempt).toHaveBeenCalled();
    });

    it("should call onSuccess callback on success", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const onSuccess = vi.fn();

      await withRetry(fn, { onSuccess });

      expect(onSuccess).toHaveBeenCalledWith("success", 1);
    });

    it("should call onFinalError callback on final failure", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Final error"));
      const onFinalError = vi.fn();

      await expect(withRetry(fn, {
        config: { maxAttempts: 2, initialDelayMs: 10 },
        onFinalError
      })).rejects.toThrow();

      expect(onFinalError).toHaveBeenCalledWith(expect.any(Error), 2);
    });

    it("should respect custom maxAttempts", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

      await expect(withRetry(fn, {
        config: { maxAttempts: 5, initialDelayMs: 10 }
      })).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(5);
    });

    it("should handle retryable errors correctly", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("rate_limit"))
        .mockRejectedValueOnce(new Error("429 Too Many Requests"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, {
        config: { maxAttempts: 3, initialDelayMs: 10 }
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("createRetryableFn", () => {
    it("should create a retryable function", async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error("ECONNRESET");
        return "success";
      };

      const retryableFn = createRetryableFn(fn, { initialDelayMs: 10 });
      const result = await retryableFn();

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("should apply custom config", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
      const retryableFn = createRetryableFn(fn, { maxAttempts: 2, initialDelayMs: 10 });

      await expect(retryableFn()).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("createRetryState", () => {
    it("should create initial retry state", () => {
      const state = createRetryState(5);

      expect(state.attempt).toBe(0);
      expect(state.totalAttempts).toBe(5);
      expect(state.startTime).toBeDefined();
      expect(state.succeeded).toBe(false);
      expect(state.lastError).toBeUndefined();
      expect(state.endTime).toBeUndefined();
    });

    it("should create state with different max attempts", () => {
      const state = createRetryState(10);

      expect(state.totalAttempts).toBe(10);
    });
  });
});
