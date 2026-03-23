// Tools 类型测试
import { describe, it, expect } from "vitest";
import { jsonResult, errorResult, filterJsonData, ToolResult, FilterLevel } from "../../../src/tools/types.js";

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
      expect(result.content).toBe('[\n  1,\n  2,\n  3\n]');
    });
  });

  describe("filterJsonData - MCP content format", () => {
    it("should filter MCP content with smart level", () => {
      const mcpData = {
        content: [
          { type: 'text', text: '关键内容', annotations: { important: true } },
          { type: 'resource', resource: { uri: 'file://test', mimeType: 'text/plain', data: 'base64' } }
        ]
      };

      const result = filterJsonData(mcpData, 'smart');

      expect(result).toEqual({
        content: [
          { type: 'text', text: '关键内容' },
          { type: 'resource', text: '[Resource content]' }
        ]
      });
    });

    it("should filter MCP content with minimal level", () => {
      const mcpData = {
        content: [
          { type: 'text', text: '关键内容', annotations: { important: true } },
          { type: 'resource', resource: { uri: 'file://test', data: 'base64' } }
        ]
      };

      const result = filterJsonData(mcpData, 'minimal');

      expect(result).toEqual({
        content: [
          { type: 'text', text: '关键内容' }
        ]
      });
    });

    it("should keep full data with full level", () => {
      const mcpData = {
        content: [
          { type: 'text', text: '关键内容', annotations: { important: true } }
        ]
      };

      const result = filterJsonData(mcpData, 'full');

      expect(result).toEqual(mcpData);
    });
  });

  describe("filterJsonData - regular JSON", () => {
    it("should filter metadata fields with smart level", () => {
      const data = {
        name: 'test',
        description: 'desc',
        annotations: { important: true },
        metadata: { created: '2024' }
      };

      const result = filterJsonData(data, 'smart');

      expect(result).toEqual({
        name: 'test',
        description: 'desc'
      });
    });

    it("should filter to essential fields with minimal level", () => {
      const data = {
        name: 'test',
        description: 'desc',
        other: 'value',
        annotations: { important: true }
      };

      const result = filterJsonData(data, 'minimal');

      expect(result).toEqual({
        name: 'test',
        description: 'desc'
      });
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
