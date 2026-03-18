// File Read Tool 测试
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createReadTool, type ReadFileParams } from "../../../src/tools/file/index.js";

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

import fs from 'node:fs/promises';

describe("File Read Tool", () => {
  let readTool: ReturnType<typeof createReadTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    readTool = createReadTool();
  });

  describe("tool metadata", () => {
    it("should have correct label", () => {
      expect(readTool.label).toBe('Read');
    });

    it("should have correct name", () => {
      expect(readTool.name).toBe('read');
    });

    it("should have description", () => {
      expect(readTool.description).toBeDefined();
      expect(readTool.description.length).toBeGreaterThan(0);
    });

    it("should have parameters schema", () => {
      expect(readTool.parameters).toBeDefined();
      expect(readTool.parameters.type).toBe('object');
      expect(readTool.parameters.properties.path).toBeDefined();
      expect(readTool.parameters.properties.from).toBeDefined();
      expect(readTool.parameters.properties.lines).toBeDefined();
      expect(readTool.parameters.required).toContain('path');
    });
  });

  describe("execute", () => {
    it("should read entire file when no options provided", async () => {
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3');

      const result = await readTool.execute('call-1', { path: '/test/file.txt' });

      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
      expect(result.content).toContain('line1');
    });

    it("should read from specific line", async () => {
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3\nline4\nline5');

      const result = await readTool.execute('call-1', { path: '/test/file.txt', from: 3 });

      expect(result.content).toContain('line3');
      expect(result.content).not.toContain('line1');
      expect((result as any).from).toBe(3);
    });

    it("should limit number of lines read", async () => {
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3\nline4\nline5');

      const result = await readTool.execute('call-1', { path: '/test/file.txt', from: 1, lines: 2 });

      const lines = (result as any).content.split('\n');
      expect(lines).toHaveLength(2);
    });

    it("should return metadata with line count", async () => {
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3');

      const result = await readTool.execute('call-1', { path: '/test/file.txt' });

      expect((result as any).lines).toBe(3);
      expect((result as any).totalLines).toBe(3);
    });

    it("should handle file not found error", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await readTool.execute('call-1', { path: '/nonexistent/file.txt' });

      expect((result as any).error).toBe(true);
    });

    it("should handle permission error", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await readTool.execute('call-1', { path: '/protected/file.txt' });

      expect((result as any).error).toBe(true);
    });
  });
});
