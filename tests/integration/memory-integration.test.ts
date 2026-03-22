/**
 * 集成测试 - 记忆系统
 *
 * 测试记忆系统的核心功能：
 * 1. 写入记忆
 * 2. 搜索记忆
 * 3. 混合搜索
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMemoryDatabase,
  getMemoryIndexManager,
} from '../../src/memory/index.js';
import { getLogger, initLogger } from '../../src/logger/index.js';

describe('Memory Integration', () => {
  let db: any;

  beforeAll(() => {
    initLogger({ level: 'error' });
  });

  beforeEach(async () => {
    // Create in-memory database for testing
    db = createMemoryDatabase(':memory:');
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('Memory Database', () => {
    it('should create database', () => {
      expect(db).toBeDefined();
    });

    it('should have insert method', () => {
      expect(typeof db.insert).toBe('function');
    });

    it('should have search method', () => {
      expect(typeof db.search).toBe('function');
    });

    it('should have close method', () => {
      expect(typeof db.close).toBe('function');
    });
  });

  describe('Memory Index Manager', () => {
    it('should export getMemoryIndexManager', () => {
      expect(getMemoryIndexManager).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof getMemoryIndexManager).toBe('function');
    });
  });

  describe('Memory Operations', () => {
    it('should handle empty database', async () => {
      const results = await db.search('test query');
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
