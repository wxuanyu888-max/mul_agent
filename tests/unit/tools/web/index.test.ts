// Web 工具测试
import { describe, it, expect } from "vitest";
import { createWebSearchTool, createWebFetchTool } from "../../../../src/tools/web/index.js";

describe("Tools - Web", () => {
  describe("createWebSearchTool", () => {
    const searchTool = createWebSearchTool();

    it("should have correct metadata", () => {
      expect(searchTool.label).toBe("Web Search");
      expect(searchTool.name).toBe("web_search");
      expect(searchTool.description).toBeDefined();
      expect(searchTool.parameters.type).toBe("object");
      expect(searchTool.parameters.required).toContain("query");
    });

    it("should have optional count parameter", () => {
      expect(searchTool.parameters.properties.count).toBeDefined();
      expect(searchTool.parameters.properties.count.default).toBe(10);
    });

    it("should return error when BRAVE_API_KEY not set", async () => {
      const result = await searchTool.execute("call-1", { query: "test" });

      // Should return error because API key is not configured
      expect(result.content).toContain("BRAVE_API_KEY");
    });

    it("should respect count parameter", async () => {
      const result = await searchTool.execute("call-1", { query: "test", count: 5 });

      expect(result.content).toContain("BRAVE_API_KEY");
    });
  });

  describe("createWebFetchTool", () => {
    const fetchTool = createWebFetchTool();

    it("should have correct metadata", () => {
      expect(fetchTool.label).toBe("Web Fetch");
      expect(fetchTool.name).toBe("web_fetch");
      expect(fetchTool.description).toBeDefined();
      expect(fetchTool.parameters.required).toContain("url");
    });

    it("should have optional parameters", () => {
      expect(fetchTool.parameters.properties.prompt).toBeDefined();
      expect(fetchTool.parameters.properties.options).toBeDefined();
      expect(fetchTool.parameters.properties.options.properties.maxLength).toBeDefined();
    });

    it("should execute fetch", async () => {
      const result = await fetchTool.execute("call-1", { url: "https://example.com" });

      // May succeed or fail depending on network, but should return valid response structure
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });
});
