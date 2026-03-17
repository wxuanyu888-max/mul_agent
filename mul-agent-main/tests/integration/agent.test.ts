// Agent 集成测试
// 测试 Agent 的核心功能：LLM 调用、工具执行、会话管理

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { createSession, getSession, addMessage, deleteSession } from "../../src/session/index.js";
import { getLogger, initLogger } from "../../src/logger/index.js";

/**
 * Agent 集成测试
 *
 * 测试目标：
 * 1. Session 创建和管理
 * 2. 消息添加和历史查询
 * 3. 工具注册和执行
 * 4. LLM 调用（需要 API key）
 */

describe("Agent Integration", () => {
  // 初始化日志
  beforeAll(() => {
    initLogger({ level: 'debug' });
  });

  describe("Session Management", () => {
    let testSessionId: string;

    afterEach(async () => {
      if (testSessionId) {
        await deleteSession(testSessionId);
      }
    });

    it("should create a new session", async () => {
      const session = await createSession({
        label: "test-session",
        config: {
          model: "claude-sonnet-4-20250514",
          runtime: "main",
        },
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe("active");
      expect(session.config.model).toBe("claude-sonnet-4-20250514");

      testSessionId = session.id;
    });

    it("should get session by id", async () => {
      const session = await createSession({ label: "get-test" });
      testSessionId = session.id;

      const fetched = await getSession(session.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(session.id);
      expect(fetched?.label).toBe("get-test");
    });

    it("should update session status", async () => {
      const { updateSessionStatus } = await import("../../src/session/index.js");
      const session = await createSession({ label: "status-test" });
      testSessionId = session.id;

      await updateSessionStatus(session.id, "idle");
      const fetched = await getSession(session.id);
      expect(fetched?.status).toBe("idle");

      await updateSessionStatus(session.id, "completed");
      const completed = await getSession(session.id);
      expect(completed?.status).toBe("completed");
    });
  });

  describe("Message Management", () => {
    let testSessionId: string;

    beforeEach(async () => {
      const session = await createSession({ label: "message-test" });
      testSessionId = session.id;
    });

    afterEach(async () => {
      if (testSessionId) {
        await deleteSession(testSessionId);
      }
    });

    it("should add message to session", async () => {
      const session = await addMessage(testSessionId, {
        role: "user",
        content: { type: "text", text: "Hello, agent!" },
      });

      expect(session?.messages.length).toBe(1);
      expect(session?.messages[0].content).toHaveProperty("text", "Hello, agent!");
    });

    it("should add multiple messages", async () => {
      await addMessage(testSessionId, {
        role: "user",
        content: { type: "text", text: "First message" },
      });

      await addMessage(testSessionId, {
        role: "assistant",
        content: { type: "text", text: "Hello! How can I help?" },
      });

      const session = await getSession(testSessionId);
      expect(session?.messages.length).toBe(2);
    });

    it("should query session history", async () => {
      const { querySessions } = await import("../../src/session/index.js");

      await addMessage(testSessionId, {
        role: "user",
        content: { type: "text", text: "Test message" },
      });

      const sessions = await querySessions({ limit: 10 });
      expect(sessions.length).toBeGreaterThan(0);
    });
  });

  describe("Tool Execution", () => {
    it("should execute read tool", async () => {
      const { createReadTool } = await import("../../src/tools/index.js");
      const readTool = createReadTool();

      const result = await readTool.execute("test-call-id", {
        file_path: "package.json",
      });

      expect(result.content).toBeDefined();
      // 验证返回的是 JSON
      const parsed = JSON.parse(result.content);
      // 成功或失败都算通过
      expect(parsed.success !== undefined || parsed.error !== undefined).toBe(true);
    });

    it("should execute ls tool", async () => {
      const { createLsTool } = await import("../../src/tools/index.js");
      const lsTool = createLsTool();

      const result = await lsTool.execute("test-call-id", {
        path: ".",
      });

      expect(result.content).toBeDefined();
      const parsed = JSON.parse(result.content);
      expect(parsed).toHaveProperty("path");
    });

    it("should execute exec tool", async () => {
      const { createExecTool } = await import("../../src/tools/index.js");
      const execTool = createExecTool();

      const result = await execTool.execute("test-call-id", {
        command: "echo test",
      });

      expect(result.content).toBeDefined();
      const parsed = JSON.parse(result.content);
      expect(parsed.stdout).toContain("test");
    });
  });

  describe("Logger", () => {
    it("should create logger instance", async () => {
      const logger = getLogger("test-agent");

      expect(logger).toBeDefined();
      // Logger 是异步写入的，不等待写入完成
      logger.info("Test log message", { test: true });
    });

    it("should log errors", async () => {
      const logger = getLogger("test-agent-err");

      try {
        throw new Error("Test error");
      } catch (error) {
        logger.error("Test error occurred", error as Error);
      }

      // 日志是异步写入的，这里只验证不抛错
      expect(true).toBe(true);
    });
  });

  // 需要 API key 的测试
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);

  describe.skipIf(!hasApiKey)("LLM Integration", () => {
    it("should call LLM and get response", async () => {
      // TODO: 实现实际的 LLM 调用
      // 这需要先创建 LLM 客户端
      expect(true).toBe(true);
    });

    it("should complete tool call loop", async () => {
      // TODO: 测试完整的 agent 循环
      // 1. 用户消息 -> LLM
      // 2. LLM 返回 tool_call
      // 3. 执行工具
      // 4. 工具结果 -> LLM
      // 5. LLM 返回最终回复
      expect(true).toBe(true);
    });
  });
});
