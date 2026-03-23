/**
 * JSON File Storage Backend
 *
 * 提供统一的 JSON 文件读写实现，使用原子写入确保数据安全
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, atomicReadJson, atomicWriteJson } from '../../utils/file-lock.js';

/**
 * JSON 存储后端选项
 */
export interface JsonStorageBackendOptions {
  /** 存储根目录 */
  baseDir: string;
  /** 文件扩展名（默认 .json） */
  extension?: string;
}

/**
 * JSON 文件存储后端
 *
 * 提供：
 * - 原子读写（防止数据损坏）
 * - 自动目录创建
 * - 统一的 CRUD 操作
 */
export class JsonStorageBackend {
  protected baseDir: string;
  protected extension: string;

  constructor(options: JsonStorageBackendOptions) {
    this.baseDir = options.baseDir;
    this.extension = options.extension ?? '.json';
  }

  /**
   * 确保目录存在
   */
  async ensureDir(dirPath: string): Promise<void> {
    await ensureDir(dirPath);
  }

  /**
   * 获取文件路径
   */
  getFilePath(id: string, subDir?: string): string {
    const dir = subDir ? path.join(this.baseDir, subDir) : this.baseDir;
    return path.join(dir, `${id}${this.extension}`);
  }

  /**
   * 读取 JSON 文件
   */
  async read<T>(filePath: string): Promise<T | null> {
    try {
      const data = await atomicReadJson<T>(filePath);
      return data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 写入 JSON 文件（原子操作）
   */
  async write<T>(filePath: string, data: T): Promise<void> {
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    await atomicWriteJson(filePath, data as Record<string, unknown>);
  }

  /**
   * 删除文件
   */
  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // 文件不存在，忽略
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 列出目录下的所有文件
   */
  async list(subDir?: string): Promise<string[]> {
    const dir = subDir ? path.join(this.baseDir, subDir) : this.baseDir;
    try {
      const files = await fs.readdir(dir);
      return files.filter(f => f.endsWith(this.extension));
    } catch {
      return [];
    }
  }

  /**
   * 获取存储目录路径
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
