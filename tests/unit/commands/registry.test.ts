// CommandRegistry 测试
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandRegistry } from "../../../src/commands/registry.js";
import type { ChatCommandDefinition, CommandHandler } from "../../../src/commands/types.js";

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe("register", () => {
    it("should register a command with its handler", () => {
      const command: ChatCommandDefinition = {
        key: "test",
        description: "Test command",
        textAliases: ["/test"],
        scope: "text",
      };
      const handler: CommandHandler = vi.fn().mockResolvedValue({
        shouldContinue: true,
      });

      registry.register(command, handler);

      expect(registry.getCommand("test")).toEqual(command);
      expect(registry.getHandler("test")).toBe(handler);
    });

    it("should register text aliases for command", () => {
      const command: ChatCommandDefinition = {
        key: "help",
        description: "Show help",
        textAliases: ["/help", "/h", "/?"],
        scope: "text",
      };
      const handler: CommandHandler = vi.fn();

      registry.register(command, handler);

      expect(registry.getCommandKeys()).toContain("help");
    });

    it("should allow registering multiple commands", () => {
      const cmd1: ChatCommandDefinition = {
        key: "cmd1",
        description: "Command 1",
        textAliases: ["/cmd1"],
        scope: "text",
      };
      const cmd2: ChatCommandDefinition = {
        key: "cmd2",
        description: "Command 2",
        textAliases: ["/cmd2"],
        scope: "text",
      };

      registry.register(cmd1, vi.fn());
      registry.register(cmd2, vi.fn());

      const commands = registry.getAllCommands();
      expect(commands).toHaveLength(2);
    });
  });

  describe("unregister", () => {
    it("should remove a command and its handler", () => {
      const command: ChatCommandDefinition = {
        key: "test",
        description: "Test command",
        textAliases: ["/test"],
        scope: "text",
      };
      const handler: CommandHandler = vi.fn();

      registry.register(command, handler);
      registry.unregister("test");

      expect(registry.getCommand("test")).toBeUndefined();
      expect(registry.getHandler("test")).toBeUndefined();
    });

    it("should remove associated text aliases", () => {
      const command: ChatCommandDefinition = {
        key: "help",
        description: "Help command",
        textAliases: ["/help", "/h"],
        scope: "text",
      };

      registry.register(command, vi.fn());
      registry.unregister("help");

      expect(registry.resolveTextCommand("/help")).toBeNull();
      expect(registry.resolveTextCommand("/h")).toBeNull();
    });
  });

  describe("resolveTextCommand", () => {
    beforeEach(() => {
      const command: ChatCommandDefinition = {
        key: "test",
        description: "Test command",
        textAliases: ["/test"],
        acceptsArgs: true,
        args: [{ name: "arg1", description: "First arg", type: "string", required: true }],
        argsParsing: "positional",
        scope: "text",
      };
      registry.register(command, vi.fn());
    });

    it("should resolve exact command match", () => {
      const result = registry.resolveTextCommand("/test");
      expect(result).not.toBeNull();
      expect(result?.key).toBe("test");
    });

    it("should return null for non-command text", () => {
      const result = registry.resolveTextCommand("hello world");
      expect(result).toBeNull();
    });

    it("should resolve command with arguments", () => {
      const result = registry.resolveTextCommand("/test myarg");
      expect(result).not.toBeNull();
      expect(result?.key).toBe("test");
      expect(result?.args).toBe("myarg");
    });

    it("should resolve case-insensitive commands", () => {
      const result = registry.resolveTextCommand("/TEST");
      expect(result).not.toBeNull();
      expect(result?.key).toBe("test");
    });
  });

  describe("parseArgs", () => {
    it("should parse positional arguments", () => {
      const command: ChatCommandDefinition = {
        key: "greet",
        description: "Greet someone",
        textAliases: ["/greet"],
        acceptsArgs: true,
        args: [
          { name: "name", description: "Name", type: "string", required: true },
          { name: "title", description: "Title", type: "string", required: false },
        ],
        argsParsing: "positional",
        scope: "text",
      };

      const result = registry.parseArgs(command, "John Mr");
      expect(result?.values).toEqual({ name: "John", title: "Mr" });
    });

    it("should return raw string when argsParsing is none", () => {
      const command: ChatCommandDefinition = {
        key: "raw",
        description: "Raw command",
        textAliases: ["/raw"],
        acceptsArgs: true,
        argsParsing: "none",
        scope: "text",
      };

      const result = registry.parseArgs(command, "some args");
      expect(result?.raw).toBe("some args");
    });
  });

  describe("buildDetection", () => {
    it("should build detection with exact matches and regex", () => {
      const command: ChatCommandDefinition = {
        key: "help",
        description: "Help command",
        textAliases: ["/help", "/h"],
        acceptsArgs: false,
        scope: "text",
      };

      registry.register(command, vi.fn());
      const detection = registry.buildDetection();

      expect(detection.exact.has("/help")).toBe(true);
      expect(detection.exact.has("/h")).toBe(true);
      expect(detection.regex).toBeInstanceOf(RegExp);
    });
  });

  describe("hasCommand", () => {
    it("should return true for existing command", () => {
      const command: ChatCommandDefinition = {
        key: "test",
        description: "Test",
        textAliases: ["/test"],
        scope: "text",
      };
      registry.register(command, vi.fn());

      expect(registry.hasCommand("test")).toBe(true);
    });

    it("should return false for non-existing command", () => {
      expect(registry.hasCommand("nonexistent")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all commands and handlers", () => {
      registry.register(
        { key: "cmd1", description: "Cmd 1", textAliases: ["/cmd1"], scope: "text" },
        vi.fn()
      );
      registry.register(
        { key: "cmd2", description: "Cmd 2", textAliases: ["/cmd2"], scope: "text" },
        vi.fn()
      );

      registry.clear();

      expect(registry.getAllCommands()).toHaveLength(0);
    });
  });
});
