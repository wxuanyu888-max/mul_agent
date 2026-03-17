// CLI Registry 测试
import { describe, it, expect, beforeEach } from "vitest";
import { CliRegistry } from "../../../src/cli/registry.js";
import type { CliCommand, CliArgs, CliContext } from "../../../src/cli/types.js";

describe("CliRegistry", () => {
  let registry: CliRegistry;

  beforeEach(() => {
    registry = new CliRegistry();
  });

  describe("register", () => {
    it("should register a command", () => {
      const command: CliCommand = {
        name: "test",
        description: "Test command",
        action: async () => {},
      };

      registry.register(command);

      expect(registry.get("test")).toEqual(command);
    });

    it("should register command aliases", () => {
      const command: CliCommand = {
        name: "help",
        description: "Show help",
        aliases: ["h", "?"],
        action: async () => {},
      };

      registry.register(command);

      expect(registry.get("help")).toEqual(command);
      expect(registry.get("h")).toEqual(command);
      expect(registry.get("?")).toEqual(command);
    });

    it("should allow registering multiple commands", () => {
      registry.register({ name: "cmd1", description: "Cmd 1", action: async () => {} });
      registry.register({ name: "cmd2", description: "Cmd 2", action: async () => {} });

      const commands = registry.getAll();
      expect(commands).toHaveLength(2);
    });
  });

  describe("get", () => {
    it("should return command by name", () => {
      const command: CliCommand = {
        name: "test",
        description: "Test",
        action: async () => {},
      };

      registry.register(command);

      expect(registry.get("test")).toEqual(command);
    });

    it("should return undefined for unknown command", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for existing command", () => {
      registry.register({ name: "test", description: "Test", action: async () => {} });

      expect(registry.has("test")).toBe(true);
    });

    it("should return false for unknown command", () => {
      expect(registry.has("unknown")).toBe(false);
    });
  });

  describe("getAll", () => {
    it("should return unique commands (no duplicates from aliases)", () => {
      registry.register({
        name: "help",
        description: "Show help",
        aliases: ["h"],
        action: async () => {},
      });

      const commands = registry.getAll();
      expect(commands).toHaveLength(1);
    });
  });

  describe("unregister", () => {
    it("should remove command and its aliases", () => {
      registry.register({
        name: "help",
        description: "Show help",
        aliases: ["h"],
        action: async () => {},
      });

      registry.unregister("help");

      expect(registry.get("help")).toBeUndefined();
      expect(registry.get("h")).toBeUndefined();
    });
  });

  describe("listCommands", () => {
    it("should list all command names including aliases", () => {
      registry.register({
        name: "help",
        description: "Show help",
        aliases: ["h"],
        action: async () => {},
      });

      const list = registry.listCommands();
      expect(list).toContain("help");
      expect(list).toContain("h");
    });
  });
});
