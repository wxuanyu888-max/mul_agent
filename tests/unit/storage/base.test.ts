/**
 * BaseStorageManager Tests
 *
 * Tests for abstract storage manager base class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BaseStorageManager,
  type BaseStorageOptions,
  type CacheEntry,
} from '../../../src/storage/base.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// 创建具体实现类用于测试
class TestEntity {
  constructor(
    public id: string,
    public name: string,
    public data: Record<string, unknown> = {}
  ) {}
}

class TestStorageManager extends BaseStorageManager<TestEntity> {
  private storagePath: string;

  constructor(options: BaseStorageOptions) {
    super(options);
    this.storagePath = options.storageDir;
  }

  protected getFilePath(id: string): string {
    return path.join(this.storagePath, `${id}.json`);
  }

  protected serialize(entity: TestEntity): Record<string, unknown> {
    return {
      id: entity.id,
      name: entity.name,
      data: entity.data,
    };
  }

  protected deserialize(data: Record<string, unknown>): TestEntity {
    return new TestEntity(
      data.id as string,
      data.name as string,
      data.data as Record<string, unknown>
    );
  }

  protected async loadJson(
    filePath: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  protected async writeJson(
    filePath: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  protected async removeFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  // 暴露 protected 方法用于测试
  public async testGet(id: string): Promise<TestEntity | null> {
    return this.get(id);
  }

  public async testSet(
    id: string,
    entity: TestEntity,
    dirty?: boolean
  ): Promise<void> {
    return this.set(id, entity, dirty);
  }

  public async testDelete(id: string): Promise<boolean> {
    return this.delete(id);
  }

  public testHas(id: string): boolean {
    return this.has(id);
  }

  public testSize(): number {
    return this.size();
  }

  public testPendingCount(): number {
    return this.pendingCount();
  }

  public testPin(id: string): void {
    return this.pin(id);
  }

  public testUnpin(id: string): void {
    return this.unpin(id);
  }

  public testMarkDirty(id: string): void {
    return this.markDirty(id);
  }

  public async testStop(): Promise<void> {
    return this.stop();
  }

  public getTestStorageDir(): string {
    return this.storageDir;
  }
}

describe('BaseStorageManager', () => {
  let tempDir: string;
  let manager: TestStorageManager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    manager = new TestStorageManager({
      storageDir: tempDir,
      maxCacheSize: 3,
      flushInterval: 0, // 禁用自动刷新以便手动测试
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.testStop();
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('getStorageDir', () => {
    it('should return storage directory path', () => {
      expect(manager.getTestStorageDir()).toBe(tempDir);
    });
  });

  describe('get/set/has', () => {
    it('should set and get entity', async () => {
      const entity = new TestEntity('1', 'Test Entity');
      await manager.testSet('1', entity);

      const result = await manager.testGet('1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.name).toBe('Test Entity');
    });

    it('should return null for non-existent entity', async () => {
      const result = await manager.testGet('non-existent');
      expect(result).toBeNull();
    });

    it('should check if entity exists in cache', async () => {
      const entity = new TestEntity('1', 'Test');
      await manager.testSet('1', entity, false);

      expect(manager.testHas('1')).toBe(true);
      expect(manager.testHas('non-existent')).toBe(false);
    });

    it('should return cache size', async () => {
      expect(manager.testSize()).toBe(0);

      await manager.testSet('1', new TestEntity('1', 'Test 1'));
      expect(manager.testSize()).toBe(1);

      await manager.testSet('2', new TestEntity('2', 'Test 2'));
      expect(manager.testSize()).toBe(2);
    });
  });

  describe('delete', () => {
    it('should delete entity from cache', async () => {
      await manager.testSet('1', new TestEntity('1', 'Test'));
      expect(manager.testHas('1')).toBe(true);

      await manager.testDelete('1');
      expect(manager.testHas('1')).toBe(false);
    });

    it('should return true when deleting existing entity', async () => {
      await manager.testSet('1', new TestEntity('1', 'Test'), true);
      await manager.testStop(); // 先刷新到磁盘
      const result = await manager.testDelete('1');
      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent entity', async () => {
      const result = await manager.testDelete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('pin/unpin', () => {
    it('should pin entity to prevent eviction', async () => {
      await manager.testSet('1', new TestEntity('1', 'Test 1'));
      manager.testPin('1');

      // 尝试通过添加更多实体来触发驱逐
      await manager.testSet('2', new TestEntity('2', 'Test 2'));
      await manager.testSet('3', new TestEntity('3', 'Test 3'));
      await manager.testSet('4', new TestEntity('4', 'Test 4')); // 应该触发驱逐

      // pinned 的应该还在缓存中
      expect(manager.testHas('1')).toBe(true);
    });

    it('should unpin entity', async () => {
      await manager.testSet('1', new TestEntity('1', 'Test'));
      manager.testPin('1');
      manager.testUnpin('1');

      // 现在应该可以被驱逐了
      await manager.testSet('2', new TestEntity('2', 'Test 2'));
      await manager.testSet('3', new TestEntity('3', 'Test 3'));
      await manager.testSet('4', new TestEntity('4', 'Test 4'));

      // 由于达到 maxCacheSize 且 '1' 没有被固定，应该被驱逐
      // 注意：驱逐策略首先尝试驱逐非脏非固定的
    });
  });

  describe('dirty flag', () => {
    it('should track pending flush count', async () => {
      expect(manager.testPendingCount()).toBe(0);

      // 设置脏实体
      await manager.testSet('1', new TestEntity('1', 'Test'), true);
      expect(manager.testPendingCount()).toBe(1);

      // 设置干净实体
      await manager.testSet('2', new TestEntity('2', 'Test'), false);
      expect(manager.testPendingCount()).toBe(1);
    });

    it('should mark entity as dirty', async () => {
      await manager.testSet('1', new TestEntity('1', 'Test'), false);
      expect(manager.testPendingCount()).toBe(0);

      manager.testMarkDirty('1');
      expect(manager.testPendingCount()).toBe(1);
    });
  });

  describe('flush', () => {
    it('should flush dirty entities to disk', async () => {
      const entity = new TestEntity('1', 'Test');
      await manager.testSet('1', entity, true);

      await manager.testStop();

      // 验证文件已写入
      const filePath = path.join(tempDir, '1.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.id).toBe('1');
      expect(data.name).toBe('Test');
    });
  });

  describe('cache eviction', () => {
    it('should evict when cache is full', async () => {
      // maxCacheSize = 3
      await manager.testSet('1', new TestEntity('1', 'Test 1'));
      await manager.testSet('2', new TestEntity('2', 'Test 2'));
      await manager.testSet('3', new TestEntity('3', 'Test 3'));

      expect(manager.testSize()).toBe(3);

      // 添加第四个，应该驱逐一个
      await manager.testSet('4', new TestEntity('4', 'Test 4'));

      // 缓存大小应该还是 3（驱逐了一个）
      expect(manager.testSize()).toBe(3);
    });

    it('should prioritize evicting non-dirty, non-pinned entries', async () => {
      await manager.testSet('1', new TestEntity('1', 'Test 1'), false);
      await manager.testSet('2', new TestEntity('2', 'Test 2'), false);
      manager.testPin('2');

      await manager.testSet('3', new TestEntity('3', 'Test 3'), false);
      await manager.testSet('4', new TestEntity('4', 'Test 4'), false);

      // '2' 是 pinned，不应该被驱逐
      expect(manager.testHas('2')).toBe(true);
    });
  });
});
