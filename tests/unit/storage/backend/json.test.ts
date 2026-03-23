/**
 * JsonStorageBackend 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonStorageBackend } from '../../../../src/storage/backend/json.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('JsonStorageBackend', () => {
  let testDir: string;
  let backend: JsonStorageBackend;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    backend = new JsonStorageBackend({ baseDir: testDir, extension: '.json' });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('read/write', () => {
    it('should write and read JSON data', async () => {
      const data = { name: 'test', value: 123 };
      const filePath = path.join(testDir, 'test.json');

      await backend.write(filePath, data);
      const result = await backend.read<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should return null for non-existent file', async () => {
      const result = await backend.read('non-existent.json');
      expect(result).toBeNull();
    });

    it('should delete file', async () => {
      const filePath = path.join(testDir, 'delete-test.json');
      await backend.write(filePath, { test: true });

      await backend.delete(filePath);
      const exists = await backend.exists(filePath);
      expect(exists).toBe(false);
    });

    it('should not throw when deleting non-existent file', async () => {
      await expect(backend.delete('non-existent.json')).resolves.not.toThrow();
    });

    it('should check if file exists', async () => {
      const filePath = path.join(testDir, 'exists-test.json');

      const existsBefore = await backend.exists(filePath);
      expect(existsBefore).toBe(false);

      await backend.write(filePath, { test: true });

      const existsAfter = await backend.exists(filePath);
      expect(existsAfter).toBe(true);
    });
  });

  describe('getFilePath', () => {
    it('should generate file path with extension', () => {
      const filePath = backend.getFilePath('test-id');
      expect(filePath).toBe(path.join(testDir, 'test-id.json'));
    });

    it('should generate file path with subdirectory', () => {
      const filePath = backend.getFilePath('test-id', 'subdir');
      expect(filePath).toBe(path.join(testDir, 'subdir', 'test-id.json'));
    });

    it('should use custom extension', () => {
      const customBackend = new JsonStorageBackend({ baseDir: testDir, extension: '.data' });
      const filePath = customBackend.getFilePath('test-id');
      expect(filePath).toBe(path.join(testDir, 'test-id.data'));
    });
  });

  describe('list', () => {
    it('should list files with extension', async () => {
      await backend.write(path.join(testDir, 'file1.json'), { test: 1 });
      await backend.write(path.join(testDir, 'file2.json'), { test: 2 });
      await fs.writeFile(path.join(testDir, 'other.txt'), 'text');

      const files = await backend.list();
      expect(files).toHaveLength(2);
      expect(files).toContain('file1.json');
      expect(files).toContain('file2.json');
    });

    it('should return empty array for empty directory', async () => {
      const files = await backend.list();
      expect(files).toEqual([]);
    });
  });

  describe('ensureDir', () => {
    it('should create directory if not exists', async () => {
      const subDir = path.join(testDir, 'nested', 'dir');
      await backend.ensureDir(subDir);

      const exists = await backend.exists(subDir);
      expect(exists).toBe(true); // exists() checks for file, but we can check via access
    });
  });
});
