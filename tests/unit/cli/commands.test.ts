// CLI Predefined Commands 测试
import { describe, it, expect, vi } from "vitest";
import {
  createHelpCommand,
  createVersionCommand,
  createStatusCommand,
  createStartCommand,
  createStopCommand,
  createListCommand,
} from "../../../src/cli/commands/index.js";
import type { CliCommand } from "../../../src/cli/types.js";

describe("CLI Predefined Commands", () => {
  const createMockContext = () => ({
    cwd: "/test",
    env: {},
    stdin: {} as any,
    stdout: { write: vi.fn() } as any,
    stderr: { write: vi.fn() } as any,
  });

  describe("createHelpCommand", () => {
    it("should create help command", () => {
      const cmd = createHelpCommand(() => []);

      expect(cmd.name).toBe("help");
      expect(cmd.aliases).toContain("h");
      expect(cmd.description).toBeDefined();
    });

    it("should print commands list", async () => {
      const getCommands = () => [
        { name: "test", description: "Test command", aliases: [] as string[] },
      ];

      const { action } = createHelpCommand(getCommands);
      const ctx = createMockContext();

      await action({}, {}, ctx);

      expect(ctx.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("test")
      );
    });
  });

  describe("createVersionCommand", () => {
    it("should create version command", () => {
      const cmd = createVersionCommand("1.0.0");

      expect(cmd.name).toBe("version");
      expect(cmd.aliases).toContain("v");
    });

    it("should print version", async () => {
      const { action } = createVersionCommand("2.0.0");
      const ctx = createMockContext();

      await action({}, {}, ctx);

      expect(ctx.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("2.0.0")
      );
    });
  });

  describe("createStatusCommand", () => {
    it("should create status command", () => {
      const cmd = createStatusCommand(async () => ({}));

      expect(cmd.name).toBe("status");
      expect(cmd.description).toBeDefined();
    });

    it("should print status JSON", async () => {
      const getStatus = async () => ({ agents: 2, sessions: 5 });
      const { action } = createStatusCommand(getStatus);
      const ctx = createMockContext();

      await action({}, {}, ctx);

      expect(ctx.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("agents")
      );
    });
  });

  describe("createStartCommand", () => {
    it("should create start command with options", () => {
      const cmd = createStartCommand(async () => {});

      expect(cmd.name).toBe("start");
      expect(cmd.aliases).toContain("run");
      expect(cmd.options).toBeDefined();
      expect(cmd.options?.find(o => o.name === "prompt")).toBeDefined();
      expect(cmd.options?.find(o => o.name === "model")).toBeDefined();
    });

    it("should call startAgent function", async () => {
      const startAgent = vi.fn().mockResolvedValue(undefined);
      const { action } = createStartCommand(startAgent);
      const ctx = createMockContext();

      await action({}, { prompt: "Hello" }, ctx);

      expect(startAgent).toHaveBeenCalled();
    });
  });

  describe("createStopCommand", () => {
    it("should create stop command", () => {
      const cmd = createStopCommand(async () => {});

      expect(cmd.name).toBe("stop");
      expect(cmd.aliases).toContain("kill");
    });

    it("should call stopAgent function", async () => {
      const stopAgent = vi.fn().mockResolvedValue(undefined);
      const { action } = createStopCommand(stopAgent);
      const ctx = createMockContext();

      await action({}, {}, ctx);

      expect(stopAgent).toHaveBeenCalled();
    });
  });

  describe("createListCommand", () => {
    it("should create list command with type option", () => {
      const cmd = createListCommand(async () => []);

      expect(cmd.name).toBe("list");
      expect(cmd.aliases).toContain("ls");
      expect(cmd.options).toBeDefined();
      expect(cmd.options?.find(o => o.name === "type")).toBeDefined();
    });

    it("should list items", async () => {
      const listItems = vi.fn().mockResolvedValue(["item1", "item2"]);
      const { action } = createListCommand(listItems);
      const ctx = createMockContext();

      await action({}, { type: "sessions" }, ctx);

      expect(listItems).toHaveBeenCalledWith("sessions");
      expect(ctx.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("item1")
      );
    });

    it("should show empty message when no items", async () => {
      const listItems = vi.fn().mockResolvedValue([]);
      const { action } = createListCommand(listItems);
      const ctx = createMockContext();

      await action({}, { type: "sessions" }, ctx);

      expect(ctx.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("No sessions")
      );
    });
  });
});
