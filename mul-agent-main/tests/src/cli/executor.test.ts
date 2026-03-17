// CLI Executor 测试
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CliExecutor, CliRegistry } from "../../../src/cli/executor.js";
import type { CliCommand, CliArgs, CliContext } from "../../../src/cli/types.js";

describe("CliExecutor", () => {
  let executor: CliExecutor;
  let registry: CliRegistry;

  beforeEach(() => {
    registry = new CliRegistry();
    executor = new CliExecutor({ registry });
  });

  describe("execute", () => {
    it("should execute a registered command", async () => {
      const action = vi.fn().mockResolvedValue(undefined);

      registry.register({
        name: "test",
        description: "Test command",
        action,
      });

      const mockStdout = { write: vi.fn() } as any;
      const mockStderr = { write: vi.fn() } as any;

      await executor.execute(["test"], {
        stdout: mockStdout,
        stderr: mockStderr,
      });

      expect(action).toHaveBeenCalled();
    });

    it("should pass args and options to action", async () => {
      let receivedArgs: CliArgs = {};
      let receivedOptions: CliArgs = {};

      registry.register({
        name: "test",
        description: "Test command",
        options: [
          { name: "name", short: "n", description: "Name", type: "string" },
        ],
        action: async (args, options) => {
          receivedArgs = args;
          receivedOptions = options;
        },
      });

      const mockStdout = { write: vi.fn() } as any;
      const mockStderr = { write: vi.fn() } as any;

      await executor.execute(["test", "arg1", "--name=Alice"], {
        stdout: mockStdout,
        stderr: mockStderr,
      });

      expect(receivedOptions.name).toBe("Alice");
    });

    it("should show error for unknown command", async () => {
      const mockStderr = { write: vi.fn() } as any;

      await executor.execute(["unknown"], {
        stderr: mockStderr,
      });

      expect(mockStderr.write).toHaveBeenCalledWith(
        expect.stringContaining("Unknown command")
      );
    });
  });

  describe("printHelp", () => {
    it("should print all commands", () => {
      registry.register({
        name: "help",
        description: "Show help",
        action: async () => {},
      });

      registry.register({
        name: "version",
        description: "Show version",
        action: async () => {},
      });

      const mockStdout = { write: vi.fn() } as any;

      executor.printHelp(mockStdout);

      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("help")
      );
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("version")
      );
    });

    it("should print command options", () => {
      registry.register({
        name: "test",
        description: "Test command",
        options: [
          { name: "verbose", short: "v", description: "Verbose mode", type: "boolean" },
        ],
        action: async () => {},
      });

      const mockStdout = { write: vi.fn() } as any;

      executor.printHelp(mockStdout);

      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("verbose")
      );
    });
  });
});
