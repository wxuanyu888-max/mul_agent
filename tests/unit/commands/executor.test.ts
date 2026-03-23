// CommandExecutor 测试
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandExecutor, CommandRegistry } from "../../../src/commands/registry.js";
import type { CommandContext } from "../../../src/commands/types.js";

describe("CommandExecutor", () => {
  let executor: CommandExecutor;
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
    executor = new CommandExecutor({ registry });
  });

  describe("execute", () => {
    it("should execute a valid command", async () => {
      const handler = vi.fn().mockResolvedValue({
        shouldContinue: true,
        reply: { text: "Command executed" },
      });

      registry.register(
        {
          key: "test",
          description: "Test command",
          textAliases: ["/test"],
          scope: "text",
        },
        handler
      );

      const context: CommandContext = {};
      const result = await executor.execute(context, "/test");

      expect(handler).toHaveBeenCalled();
      expect(result.shouldContinue).toBe(true);
      expect(result.reply?.text).toBe("Command executed");
    });

    it("should return shouldContinue=true for non-command input", async () => {
      const result = await executor.execute({}, "hello world");

      expect(result.shouldContinue).toBe(true);
    });

    it("should return shouldContinue=true for unknown command", async () => {
      const result = await executor.execute({}, "/unknown");

      expect(result.shouldContinue).toBe(true);
    });

    it("should pass parsed arguments to handler", async () => {
      let capturedArgs: any;

      const handler = vi.fn().mockImplementation(
        async (_ctx: CommandContext, args: any) => {
          capturedArgs = args;
          return { shouldContinue: true };
        }
      );

      registry.register(
        {
          key: "greet",
          description: "Greet",
          textAliases: ["/greet"],
          acceptsArgs: true,
          args: [{ name: "name", description: "Name", type: "string", required: true }],
          argsParsing: "positional",
          scope: "text",
        },
        handler
      );

      await executor.execute({}, "/greet John");

      expect(capturedArgs?.values?.name).toBe("John");
    });

    it("should handle command execution errors gracefully", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler error"));

      registry.register(
        {
          key: "error",
          description: "Error command",
          textAliases: ["/error"],
          scope: "text",
        },
        handler
      );

      const result = await executor.execute({}, "/error");

      expect(result.shouldContinue).toBe(false);
      expect(result.reply?.text).toContain("Command execution failed");
    });
  });

  describe("listCommands", () => {
    it("should list all registered commands", () => {
      registry.register(
        { key: "cmd1", description: "Cmd 1", textAliases: ["/cmd1"], scope: "text" },
        vi.fn()
      );
      registry.register(
        { key: "cmd2", description: "Cmd 2", textAliases: ["/cmd2"], scope: "text" },
        vi.fn()
      );

      const commands = executor.listCommands();

      expect(commands).toHaveLength(2);
    });
  });

  describe("getHelpText", () => {
    it("should return help text for existing command", () => {
      registry.register(
        {
          key: "help",
          description: "Show help",
          textAliases: ["/help"],
          scope: "text",
          args: [{ name: "topic", description: "Help topic", type: "string", required: false }],
        },
        vi.fn()
      );

      const help = executor.getHelpText("help");

      expect(help).toContain("/help: Show help");
      expect(help).toContain("topic");
    });

    it("should return undefined for unknown command", () => {
      const help = executor.getHelpText("unknown");

      expect(help).toBeUndefined();
    });
  });
});
