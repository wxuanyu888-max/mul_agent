// Tools 类型测试
import { describe, it, expect } from "vitest";
import { jsonResult, errorResult, ToolResult } from "../../../src/tools/types.js";

describe("Tools Types", () => {
  describe("jsonResult", () => {
    it("should create JSON string from object", () => {
      const result = jsonResult({ name: "test", value: 123 });

      expect(result.content).toBe('{\n  "name": "test",\n  "value": 123\n}');
    });

    it("should handle empty object", () => {
      const result = jsonResult({});
      expect(result.content).toBe("{}");
    });

    it("should handle array", () => {
      const result = jsonResult([1, 2, 3]);
      expect(result.content).toBe("[\n  1,\n  2,\n  3\n]");
    });
  });

  describe("errorResult", () => {
    it("should create error result with message", () => {
      const result = errorResult("File not found");

      expect(result.error).toBe("File not found");
      expect(result.content).toContain("error");
      expect(result.content).toContain("File not found");
    });

    it("should handle empty error message", () => {
      const result = errorResult("");
      expect(result.error).toBe("");
      expect(result.content).toContain("error");
    });
  });

  describe("ToolResult interface", () => {
    it("should allow valid tool result", () => {
      const result: ToolResult = {
        content: "Hello world",
      };

      expect(result.content).toBe("Hello world");
      expect(result.error).toBeUndefined();
    });

    it("should allow error result", () => {
      const result: ToolResult = {
        content: '{"error": "failed"}',
        error: "failed",
      };

      expect(result.error).toBe("failed");
    });
  });
});
