/**
 * E2E 测试 - 工具执行流程
 *
 * 端到端测试工具执行：
 * 1. 文件读取
 * 2. 文件写入
 * 3. 命令执行
 * 4. 错误处理
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadTool, createWriteTool, createLsTool, createGrepTool, createExecTool } from '../../src/tools/index.js';

describe('Tools E2E', () => {
  const testDir = path.join(import.meta.dirname, 'test-output');
  const testFiles: string[] = [];

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test files
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore
      }
    }
    testFiles.length = 0;

    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('File Tools', () => {
    it('should read existing file', async () => {
      const readTool = createReadTool();

      const result = await readTool.execute('call-1', { path: 'package.json' });

      expect(result.error).toBeNull();
      expect(result.content).toContain('name');
    });

    it('should return error for non-existent file', async () => {
      const readTool = createReadTool();

      const result = await readTool.execute('call-1', { path: '/non/existent/file.txt' });

      expect(result.error).toBeDefined();
    });

    it('should write and read file', async () => {
      const writeTool = createWriteTool();
      const readTool = createReadTool();
      const filePath = path.join(testDir, 'test-output.txt');
      testFiles.push(filePath);

      // Write
      const writeResult = await writeTool.execute('call-1', {
        path: filePath,
        content: 'Hello, World!',
      });
      expect(writeResult.error).toBeNull();

      // Read
      const readResult = await readTool.execute('call-2', { path: filePath });
      expect(readResult.error).toBeNull();
      expect(readResult.content).toContain('Hello, World!');
    });

    it('should list directory contents', async () => {
      const lsTool = createLsTool();

      // Create some test files
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      testFiles.push(
        path.join(testDir, 'file1.txt'),
        path.join(testDir, 'file2.txt')
      );

      const result = await lsTool.execute('call-1', { path: testDir });

      expect(result.error).toBeNull();
      expect(result.content).toContain('file1.txt');
      expect(result.content).toContain('file2.txt');
    });

    it('should return error for non-existent directory', async () => {
      const lsTool = createLsTool();

      const result = await lsTool.execute('call-1', { path: '/non/existent/dir' });

      expect(result.error).toBeDefined();
    });

    it('should search with grep', async () => {
      const grepTool = createGrepTool();
      const filePath = path.join(testDir, 'search-test.txt');
      testFiles.push(filePath);

      await fs.writeFile(filePath, 'Hello World\nHello Claude\nGoodbye World', 'utf-8');

      const result = await grepTool.execute('call-1', {
        pattern: 'Hello',
        path: testDir,
      });

      expect(result.error).toBeNull();
      expect(result.content).toContain('Hello');
    });
  });

  describe('Bash Tools', () => {
    it('should execute simple command', async () => {
      const execTool = createExecTool();

      const result = await execTool.execute('call-1', { command: 'echo "Hello"' });

      expect(result.error).toBeNull();
      expect(result.content).toContain('Hello');
    });

    it('should return error for failed command', async () => {
      const execTool = createExecTool();

      const result = await execTool.execute('call-1', { command: 'exit 1' });

      expect(result.error).toBeDefined();
    });

    it('should handle command with pipes', async () => {
      const execTool = createExecTool();

      const result = await execTool.execute('call-1', { command: 'echo "test" | cat' });

      expect(result.error).toBeNull();
      expect(result.content).toContain('test');
    });
  });

  describe('Tool Chaining', () => {
    it('should execute multiple tools in sequence', async () => {
      const writeTool = createWriteTool();
      const readTool = createReadTool();
      const execTool = createExecTool();

      const filePath = path.join(testDir, 'chained.txt');
      testFiles.push(filePath);

      // 1. Write file
      await writeTool.execute('call-1', { path: filePath, content: 'test content' });

      // 2. Read file
      const readResult = await readTool.execute('call-2', { path: filePath });
      expect(readResult.content).toContain('test content');

      // 3. Verify via bash
      const execResult = await execTool.execute('call-3', { command: `cat "${filePath}"` });
      expect(execResult.content).toContain('test content');
    });
  });
});
