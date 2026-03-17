// File 工具测试
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createReadTool, createWriteTool, createLsTool, createGrepTool } from "../../../src/tools/file/index.js";

describe("Tools - File", () => {
  const testDir = path.join(import.meta.dirname, "test-fixtures");

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("createReadTool", () => {
    const readTool = createReadTool();

    it("should have correct metadata", () => {
      expect(readTool.label).toBe("Read");
      expect(readTool.name).toBe("read");
      expect(readTool.description).toBeDefined();
      expect(readTool.parameters.type).toBe("object");
      expect(readTool.parameters.required).toContain("path");
    });

    it("should read file content", async () => {
      const filePath = path.join(testDir, "test.txt");
      await fs.writeFile(filePath, "Hello World", "utf-8");

      const result = await readTool.execute("call-1", { path: filePath });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("Hello World");
    });

    it("should return error for non-existent file", async () => {
      const result = await readTool.execute("call-1", { path: "/non/existent/file.txt" });

      expect(result.error).toBeDefined();
    });

    it("should support line range", async () => {
      const filePath = path.join(testDir, "lines.txt");
      await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5", "utf-8");

      const result = await readTool.execute("call-1", { path: filePath, from: 2, lines: 2 });

      expect(result.content).toContain("Line 2");
      expect(result.content).toContain("Line 3");
      expect(result.content).not.toContain("Line 1");
    });
  });

  describe("createWriteTool", () => {
    const writeTool = createWriteTool();

    it("should have correct metadata", () => {
      expect(writeTool.label).toBe("Write");
      expect(writeTool.name).toBe("write");
      expect(writeTool.parameters.required).toContain("path");
      expect(writeTool.parameters.required).toContain("content");
    });

    it("should write content to file", async () => {
      const filePath = path.join(testDir, "output.txt");

      const result = await writeTool.execute("call-1", {
        path: filePath,
        content: "Test content",
      });

      expect(result.error).toBeUndefined();

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toBe("Test content");
    });

    it("should return error for invalid path", async () => {
      const result = await writeTool.execute("call-1", {
        path: "/invalid/path/file.txt",
        content: "test",
      });

      expect(result.error).toBeDefined();
    });
  });

  describe("createLsTool", () => {
    const lsTool = createLsTool();

    it("should have correct metadata", () => {
      expect(lsTool.label).toBe("LS");
      expect(lsTool.name).toBe("ls");
    });

    it("should list directory contents", async () => {
      await fs.writeFile(path.join(testDir, "file1.txt"), "content");
      await fs.writeFile(path.join(testDir, "file2.txt"), "content");

      const result = await lsTool.execute("call-1", { path: testDir });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("file1.txt");
      expect(result.content).toContain("file2.txt");
    });

    it("should return error for non-existent directory", async () => {
      const result = await lsTool.execute("call-1", { path: "/non/existent/dir" });

      expect(result.error).toBeDefined();
    });
  });

  describe("createGrepTool", () => {
    const grepTool = createGrepTool();

    it("should have correct metadata", () => {
      expect(grepTool.label).toBe("Grep");
      expect(grepTool.name).toBe("grep");
      expect(grepTool.parameters.required).toContain("pattern");
    });

    it("should search for pattern in files", async () => {
      const filePath = path.join(testDir, "search.txt");
      await fs.writeFile(filePath, "Hello World\nHello Claude\nGoodbye", "utf-8");

      const result = await grepTool.execute("call-1", {
        pattern: "Hello",
        path: testDir,
      });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("Hello");
    });
  });
});
