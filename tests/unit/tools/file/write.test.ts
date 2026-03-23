// File Write Tool 测试
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWriteTool, type WriteFileParams } from "../../../src/tools/file/index.js";

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import fs from 'node:fs/promises';

describe("File Write Tool", () => {
  let writeTool: ReturnType<typeof createWriteTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeTool = createWriteTool();
  });

  describe("tool metadata", () => {
    it("should have correct label", () => {
      expect(writeTool.label).toBe('Write');
    });

    it("should have correct name", () => {
      expect(writeTool.name).toBe('write');
    });

    it("should have description", () => {
      expect(writeTool.description).toBeDefined();
      expect(writeTool.description.length).toBeGreaterThan(0);
    });

    it("should have parameters schema", () => {
      expect(writeTool.parameters).toBeDefined();
      expect(writeTool.parameters.type).toBe('object');
      expect(writeTool.parameters.properties.path).toBeDefined();
      expect(writeTool.parameters.properties.content).toBeDefined();
      expect(writeTool.parameters.properties.createDirectories).toBeDefined();
      expect(writeTool.parameters.required).toContain('path');
      expect(writeTool.parameters.required).toContain('content');
    });
  });

  describe("execute", () => {
    it("should write content to file", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeTool.execute('call-1', {
        path: '/test/file.txt',
        content: 'Hello World',
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'Hello World', 'utf-8');
      expect((result as any).success).toBe(true);
      expect((result as any).path).toBe('/test/file.txt');
    });

    it("should create parent directories by default", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeTool.execute('call-1', {
        path: '/new/dir/file.txt',
        content: 'content',
      });

      expect(fs.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });

    it("should skip directory creation when createDirectories is false", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeTool.execute('call-1', {
        path: '/existing/dir/file.txt',
        content: 'content',
        createDirectories: false,
      });

      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it("should return line count", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeTool.execute('call-1', {
        path: '/test/file.txt',
        content: 'line1\nline2\nline3',
      });

      expect((result as any).lines).toBe(3);
    });

    it("should return byte count", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeTool.execute('call-1', {
        path: '/test/file.txt',
        content: 'Hello',
      });

      expect((result as any).bytes).toBe(5);
    });

    it("should handle write error", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      const result = await writeTool.execute('call-1', {
        path: '/test/file.txt',
        content: 'content',
      });

      expect((result as any).error).toBe(true);
    });

    it("should handle permission error", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await writeTool.execute('call-1', {
        path: '/protected/file.txt',
        content: 'content',
      });

      expect((result as any).error).toBe(true);
    });

    it("should handle directory creation error", async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('EACCES'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeTool.execute('call-1', {
        path: '/protected/file.txt',
        content: 'content',
      });

      expect((result as any).error).toBe(true);
    });
  });
});
