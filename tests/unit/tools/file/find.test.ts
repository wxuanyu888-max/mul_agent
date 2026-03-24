// Find Tool 测试
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createFindTool } from "../../../../src/tools/file/find.js";
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Find Tool', () => {
  let findTool: ReturnType<typeof createFindTool>;
  let testDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'find-test-'));

    // 创建测试文件结构
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'src', 'utils'));
    await fs.mkdir(path.join(testDir, 'tests'));

    await fs.writeFile(path.join(testDir, 'index.ts'), 'export const x = 1;');
    await fs.writeFile(path.join(testDir, 'src', 'app.ts'), 'export const app = {};');
    await fs.writeFile(path.join(testDir, 'src', 'utils', 'helper.ts'), 'export const helper = {};');
    await fs.writeFile(path.join(testDir, 'tests', 'app.test.ts'), 'describe("test", () => {});');
    await fs.writeFile(path.join(testDir, 'package.json'), '{}');
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test');

    findTool = createFindTool();
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Definition', () => {
    it('should have correct name and label', () => {
      expect(findTool.name).toBe('find');
      expect(findTool.label).toBe('Find');
    });

    it('should have pattern and ext parameters', () => {
      const paramNames = Object.keys(findTool.parameters.properties);
      expect(paramNames).toContain('pattern');
      expect(paramNames).toContain('ext');
    });

    it('should require name parameter', () => {
      expect(findTool.parameters.required).toContain('name');
    });
  });

  describe('execute - name pattern', () => {
    it('should find files by name pattern with *', async () => {
      const result = await findTool.execute('test-id', {
        name: '*.ts',
        path: testDir,
        type: 'file',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      expect(data.count).toBeGreaterThanOrEqual(1);
      expect(data.results[0]).toContain('.ts');
    });

    it('should find files by name pattern with ?', async () => {
      const result = await findTool.execute('test-id', {
        name: 'index.???',
        path: testDir,
        type: 'file',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      expect(data.count).toBeGreaterThanOrEqual(1);
    });

    it('should find directories', async () => {
      const result = await findTool.execute('test-id', {
        name: 'src',
        path: testDir,
        type: 'directory',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      expect(data.count).toBe(1);
    });

    it('should return empty for no matches', async () => {
      const result = await findTool.execute('test-id', {
        name: 'nonexistent.*',
        path: testDir,
        type: 'file',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      expect(data.count).toBe(0);
    });
  });

  describe('execute - ext filter', () => {
    it('should filter by extension', async () => {
      const result = await findTool.execute('test-id', {
        name: '*',
        path: testDir,
        type: 'file',
        ext: '.ts',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      // 应该有 .ts 文件
      expect(data.count).toBeGreaterThanOrEqual(1);
    });

    it('should filter by extension without dot', async () => {
      const result = await findTool.execute('test-id', {
        name: '*',
        path: testDir,
        type: 'file',
        ext: 'json',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      expect(data.count).toBe(1);
    });
  });

  describe('execute - glob pattern', () => {
    it('should find files with glob pattern', async () => {
      const result = await findTool.execute('test-id', {
        pattern: 'src/**/*.ts',
        path: testDir,
        type: 'file',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      // src 目录下应该有 ts 文件
      expect(data.count).toBeGreaterThanOrEqual(1);
    });

    it('should find files with simple glob like *.ts', async () => {
      const result = await findTool.execute('test-id', {
        pattern: '*.ts',
        path: testDir,
        type: 'file',
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      // *.ts 会匹配所有目录下的 .ts 文件（包括子目录）
      expect(data.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('execute - maxResults', () => {
    it('should limit results', async () => {
      const result = await findTool.execute('test-id', {
        pattern: '**/*.ts',
        path: testDir,
        type: 'file',
        maxResults: 2,
      });

      expect(result).toHaveProperty('content');
      const data = JSON.parse(result.content);
      expect(data.count).toBeLessThanOrEqual(2);
    });
  });

  describe('execute - error cases', () => {
    it('should return error when neither name nor pattern provided', async () => {
      const result = await findTool.execute('test-id', {
        path: testDir,
        type: 'file',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('required');
    });
  });
});
