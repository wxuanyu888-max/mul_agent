// Memory 工具测试
import { describe, it, expect } from "vitest";
import { createMemorySearchTool, createMemoryGetTool } from "../../../src/tools/memory/index.js";

describe("Tools - Memory", () => {
  describe("createMemorySearchTool", () => {
    const searchTool = createMemorySearchTool();

    it("should have correct metadata", () => {
      expect(searchTool.label).toBe("Memory Search");
      expect(searchTool.name).toBe("memory_search");
      expect(searchTool.description).toBeDefined();
      expect(searchTool.parameters.required).toContain("query");
    });

    it("should have optional limit parameter", () => {
      expect(searchTool.parameters.properties.limit).toBeDefined();
    });

    it("should execute search", async () => {
      const result = await searchTool.execute("call-1", { query: "test" });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("query");
    });
  });

  describe("createMemoryGetTool", () => {
    const getTool = createMemoryGetTool();

    it("should have correct metadata", () => {
      expect(getTool.label).toBe("Memory Get");
      expect(getTool.name).toBe("memory_get");
      expect(getTool.parameters.required).toContain("id");
    });

    it("should execute get", async () => {
      const result = await getTool.execute("call-1", { id: "mem-123" });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("id");
    });
  });
});
