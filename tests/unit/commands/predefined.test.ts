// Predefined Commands 测试
import { describe, it, expect, vi } from "vitest";
import {
  createCommandHandler,
  createHelpCommand,
  createStatusCommand,
  createMemoryCommand,
  createHistoryCommand,
  createSkillsCommand,
  createResetCommand,
  createStopCommand,
} from "../../../src/commands/predefined.js";

describe("Predefined Commands", () => {
  describe("createCommandHandler", () => {
    it("should create a command definition with defaults", () => {
      const { definition, handler } = createCommandHandler(
        "test",
        "Test command",
        async () => ({ text: "test" })
      );

      expect(definition.key).toBe("test");
      expect(definition.description).toBe("Test command");
      expect(definition.textAliases).toContain("/test");
      expect(definition.category).toBe("info");
    });

    it("should accept custom aliases", () => {
      const { definition } = createCommandHandler(
        "help",
        "Show help",
        async () => {},
        { aliases: ["/help", "/h", "/?"] }
      );

      expect(definition.textAliases).toEqual(["/help", "/h", "/?"]);
    });

    it("should set acceptsArgs based on args", () => {
      const { definition: withArgs } = createCommandHandler(
        "cmd1",
        "With args",
        async () => {},
        { args: [{ name: "arg", description: "Arg", type: "string" }] }
      );

      const { definition: withoutArgs } = createCommandHandler(
        "cmd2",
        "Without args",
        async () => {}
      );

      expect(withArgs.acceptsArgs).toBe(true);
      expect(withoutArgs.acceptsArgs).toBe(false);
    });

    it("should return shouldContinue=false when handler returns result", async () => {
      const { handler } = createCommandHandler(
        "test",
        "Test",
        async () => ({ text: "result" })
      );

      const result = await handler({}, undefined);

      expect(result?.shouldContinue).toBe(false);
      expect(result?.reply?.text).toBe("result");
    });

    it("should return shouldContinue=true when handler returns void", async () => {
      const { handler } = createCommandHandler(
        "test",
        "Test",
        async () => {}
      );

      const result = await handler({}, undefined);

      expect(result?.shouldContinue).toBe(true);
    });
  });

  describe("createHelpCommand", () => {
    it("should generate help text from commands list", async () => {
      const getCommands = () => [
        { key: "help", description: "Show help", textAliases: ["/help"] },
        { key: "status", description: "Show status", textAliases: ["/status"] },
      ];

      const { handler } = createHelpCommand(getCommands);
      const result = await handler({}, undefined);

      expect(result?.reply?.text).toContain("Available commands:");
      expect(result?.reply?.text).toContain("/help");
      expect(result?.reply?.text).toContain("/status");
    });
  });

  describe("createStatusCommand", () => {
    it("should return status JSON", async () => {
      const getStatus = async () => ({ agents: 2, sessions: 5 });

      const { handler } = createStatusCommand(getStatus);
      const result = await handler({}, undefined);

      expect(result?.reply?.text).toContain("agents");
      expect(result?.reply?.text).toContain("2");
    });
  });

  describe("createMemoryCommand", () => {
    it("should search memories with query", async () => {
      const recallFn = vi.fn().mockResolvedValue(["memory1", "memory2"]);

      const { handler } = createMemoryCommand(recallFn);
      const result = await handler(
        {},
        { values: { query: "test" } }
      );

      expect(recallFn).toHaveBeenCalledWith("test");
      expect(result?.reply?.text).toContain("memory1");
    });

    it("should return no memories message when empty", async () => {
      const recallFn = vi.fn().mockResolvedValue([]);

      const { handler } = createMemoryCommand(recallFn);
      const result = await handler({}, { values: {} });

      expect(result?.reply?.text).toBe("No memories found.");
    });
  });

  describe("createHistoryCommand", () => {
    it("should retrieve history with limit", async () => {
      const getHistory = vi.fn().mockResolvedValue(["msg1", "msg2"]);

      const { handler } = createHistoryCommand(getHistory);
      const result = await handler(
        { sessionId: "my-session" },
        { values: { limit: 5 } }
      );

      expect(getHistory).toHaveBeenCalledWith("my-session", 5);
      expect(result?.reply?.text).toContain("msg1");
    });

    it("should use default session and limit", async () => {
      const getHistory = vi.fn().mockResolvedValue([]);

      const { handler } = createHistoryCommand(getHistory);
      await handler({}, { values: {} });

      expect(getHistory).toHaveBeenCalledWith("default", 10);
    });
  });

  describe("createSkillsCommand", () => {
    it("should list available skills", async () => {
      const getSkills = async () => [
        { name: "skill1", description: "Desc 1" },
        { name: "skill2", description: "Desc 2" },
      ];

      const { handler } = createSkillsCommand(getSkills);
      const result = await handler({}, undefined);

      expect(result?.reply?.text).toContain("skill1");
    });

    it("should return no skills message when empty", async () => {
      const getSkills = async () => [];

      const { handler } = createSkillsCommand(getSkills);
      const result = await handler({}, undefined);

      expect(result?.reply?.text).toBe("No skills available.");
    });
  });

  describe("createResetCommand", () => {
    it("should call reset with sessionId", async () => {
      const resetFn = vi.fn().mockResolvedValue(undefined);

      const { handler } = createResetCommand(resetFn);
      const result = await handler({ sessionId: "test-session" }, undefined);

      expect(resetFn).toHaveBeenCalledWith("test-session");
      expect(result?.reply?.text).toContain("reset successfully");
    });
  });

  describe("createStopCommand", () => {
    it("should call stop with sessionId", async () => {
      const stopFn = vi.fn().mockResolvedValue(undefined);

      const { handler } = createStopCommand(stopFn);
      const result = await handler({ sessionId: "test-session" }, undefined);

      expect(stopFn).toHaveBeenCalledWith("test-session");
      expect(result?.reply?.text).toContain("stopped");
    });
  });
});
