// CLI Argv Parser 测试
import { describe, it, expect } from "vitest";
import { parseArgs, validateOptions, withDefaults } from "../../../src/cli/parsers/argv.js";
import type { CliOption } from "../../../src/cli/types.js";

describe("CLI Argv Parser", () => {
  describe("parseArgs", () => {
    it("should parse command name", () => {
      const result = parseArgs(["node", "test"]);

      expect(result.command).toBe("test");
    });

    it("should parse long options", () => {
      const result = parseArgs(["node", "test", "--name=Alice", "--verbose"]);

      expect(result.options.name).toBe("Alice");
      expect(result.options.verbose).toBe(true);
    });

    it("should parse short options", () => {
      const result = parseArgs(["node", "test", "-n", "Bob", "-v"]);

      expect(result.options.n).toBe("Bob");
      expect(result.options.v).toBe(true);
    });

    it("should parse positional arguments", () => {
      const result = parseArgs(["node", "test", "arg1", "arg2"]);

      expect(result.args.arg0).toBe("arg1");
      expect(result.args.arg1).toBe("arg2");
    });

    it("should handle mixed options and args", () => {
      const result = parseArgs(["node", "test", "--name=Alice", "file.txt"]);

      expect(result.options.name).toBe("Alice");
      expect(result.args.arg0).toBe("file.txt");
    });

    it("should handle empty argv", () => {
      const result = parseArgs(["node"]);

      expect(result.command).toBe("");
    });
  });

  describe("validateOptions", () => {
    it("should return valid for all required options present", () => {
      const schema: CliOption[] = [
        { name: "name", type: "string", required: true },
      ];

      const result = validateOptions({ name: "Alice" }, schema);

      expect(result.valid).toBe(true);
    });

    it("should return invalid for missing required option", () => {
      const schema: CliOption[] = [
        { name: "name", type: "string", required: true },
      ];

      const result = validateOptions({}, schema);

      expect(result.valid).toBe(false);
      expect(result.missing).toBe("name");
    });

    it("should ignore non-required options", () => {
      const schema: CliOption[] = [
        { name: "verbose", type: "boolean", required: false },
      ];

      const result = validateOptions({}, schema);

      expect(result.valid).toBe(true);
    });
  });

  describe("withDefaults", () => {
    it("should apply default values", () => {
      const schema: CliOption[] = [
        { name: "verbose", type: "boolean", default: false },
        { name: "count", type: "number", default: 10 },
      ];

      const result = withDefaults({}, schema);

      expect(result.verbose).toBe(false);
      expect(result.count).toBe(10);
    });

    it("should not override provided values", () => {
      const schema: CliOption[] = [
        { name: "verbose", type: "boolean", default: false },
      ];

      const result = withDefaults({ verbose: true }, schema);

      expect(result.verbose).toBe(true);
    });
  });
});
