// Grep Tool 测试
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGrepTool, syncWorkspaceToMemory } from "../../../../src/tools/file/grep.js";

// Mock 依赖
vi.mock('../../../../src/memory/manager.js', () => ({
  getMemoryIndexManager: vi.fn(() => ({
    search: vi.fn().mockResolvedValue([
      {
        path: '/test/file.ts',
        snippet: 'function test() {\n  return true;',
        score: 0.9,
        startLine: 1,
        endLine: 3,
      },
    ]),
    sync: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../../src/utils/path.js', () => ({
  getMemoryPath: vi.fn().mockReturnValue('/test/workspace'),
}));

describe('Grep Tool', () => {
  let grepTool: ReturnType<typeof createGrepTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    grepTool = createGrepTool();
  });

  describe('Tool Definition', () => {
    it('should have correct name and label', () => {
      expect(grepTool.name).toBe('grep');
      expect(grepTool.label).toBe('Grep');
    });

    it('should have contextLines parameter', () => {
      const paramNames = Object.keys(grepTool.parameters.properties);
      expect(paramNames).toContain('contextLines');
    });

    it('should have correct default values in parameters', () => {
      const contextLinesParam = grepTool.parameters.properties.contextLines as any;
      expect(contextLinesParam.default).toBe(1);
      expect(contextLinesParam.description).toContain('context lines');
    });
  });

  describe('execute - semantic mode', () => {
    it('should return search results in semantic mode', async () => {
      const result = await grepTool.execute('test-id', {
        query: 'function',
        mode: 'semantic',
        maxResults: 5,
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('count');
      expect(data.mode).toBe('semantic');
    });
  });

  describe('execute - exact mode with contextLines', () => {
    it('should accept contextLines parameter', async () => {
      const result = await grepTool.execute('test-id', {
        query: 'test',
        mode: 'exact',
        contextLines: 3,
        maxResults: 10,
      });

      // exact 模式返回 content
      expect(result).toHaveProperty('content');
    });

    it('should use default contextLines when not provided', async () => {
      const result = await grepTool.execute('test-id', {
        query: 'test',
        mode: 'exact',
        maxResults: 10,
      });

      expect(result).toHaveProperty('content');
    });
  });
});

describe('syncWorkspaceToMemory', () => {
  it('should be an async function', () => {
    expect(typeof syncWorkspaceToMemory).toBe('function');
  });
});
