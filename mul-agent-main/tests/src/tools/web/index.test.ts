// Web 工具测试
import { describe, it, expect } from "vitest";
import { createWebSearchTool, createWebFetchTool } from "../../../src/tools/web/index.js";

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

    it("should execute search", async () => {
      const result = await searchTool.execute("call-1", { query: "test" });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("results");
      expect(result.content).toContain("test");
    });

    it("should respect count parameter", async () => {
      const result = await searchTool.execute("call-1", { query: "test", count: 5 });

      expect(result.content).toContain("count");
      expect(result.content).toContain("5");
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
      expect(fetchTool.parameters.properties.extract).toBeDefined();
      expect(fetchTool.parameters.properties.maxLength).toBeDefined();
    });

    it("should execute fetch", async () => {
      const result = await fetchTool.execute("call-1", { url: "https://example.com" });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("url");
      expect(result.content).toContain("https://example.com");
    });
  });
});
