/**
 * File Memory Service
 *
 * 存储上传文件的内容到向量数据库
 */

import path from 'path';
import crypto from 'crypto';
import { MemoryDatabase } from '../memory/database.js';
import { createEmbeddingProvider, type EmbeddingProviderOptions } from '../memory/embeddings/index.js';
import type { MemorySearchConfig, MemorySource } from '../memory/types.js';
import type { MemorySearchConfig, MemorySource } from './types.js';
import { getSessionsPath } from '../utils/path.js';

// 默认配置
const DEFAULT_CONFIG: MemorySearchConfig = {
  enabled: true,
  provider: 'ollama',
  model: 'nomic-embed-text',
  sources: ['memory'],
  vector: { enabled: true },
  fts: { enabled: true },
  cache: { enabled: false },
  fallback: 'offline',
};

interface FileMemoryServiceOptions {
  agentId?: string;
}

/**
 * File Memory Service - 用于存储上传文件的向量
 */
export class FileMemoryService {
  private db: MemoryDatabase;
  private provider: any = null;
  private agentId: string;

  constructor(options: FileMemoryServiceOptions = {}) {
    this.agentId = options.agentId || 'file-upload';

    // 创建数据库
    const uploadsDir = getSessionsPath();
    const dbPath = path.join(uploadsDir, '..', 'memory', 'file-memory.json');
    this.db = new MemoryDatabase({
      dbPath,
      vectorEnabled: true,
    });
  }

  /**
   * 初始化 embedding provider
   */
  async init(): Promise<void> {
    const providerOptions: EmbeddingProviderOptions = {
      provider: DEFAULT_CONFIG.provider as any,
      model: DEFAULT_CONFIG.model,
      fallback: DEFAULT_CONFIG.fallback as any,
    };

    const result = await createEmbeddingProvider(providerOptions);
    if (result.provider) {
      this.provider = result.provider;
    } else {
      console.warn('[FileMemory] Embedding provider unavailable:', result.providerUnavailableReason);
    }
  }

  /**
   * 存储文件内容到向量数据库
   */
  async addFile(fileId: string, content: string, filename: string): Promise<void> {
    if (!content || content.trim().length === 0) {
      return;
    }

    const filePath = `upload:${fileId}:${filename}`;
    const source: MemorySource = {
      type: 'file',
      name: filename,
      path: filePath,
    };

    // 删除旧的 chunks
    this.db.deleteChunksByPath(filePath);

    // 分块内容
    const chunks = this.chunkContent(content);

    // 插入新 chunks
    for (const chunk of chunks) {
      let embedding: number[] | undefined;

      if (this.provider) {
        try {
          embedding = await this.provider.embedQuery(chunk.content);
        } catch (error) {
          console.error('[FileMemory] Failed to embed chunk:', error);
        }
      }

      this.db.insertChunk({
        id: chunk.id,
        path: filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        embedding,
        source,
        indexedAt: Date.now(),
      });
    }

    console.log(`[FileMemory] Stored ${chunks.length} chunks for file ${fileId}`);
  }

  /**
   * 搜索文件内容
   */
  async search(query: string, maxResults: number = 5): Promise<any[]> {
    if (!this.provider || !query.trim()) {
      return [];
    }

    try {
      const embedding = await this.provider.embedQuery(query);
      return this.db.vectorSearch(embedding, maxResults);
    } catch (error) {
      console.error('[FileMemory] Search failed:', error);
      return [];
    }
  }

  /**
   * 删除文件内容
   */
  deleteFile(fileId: string, filename: string): void {
    const filePath = `upload:${fileId}:${filename}`;
    this.db.deleteChunksByPath(filePath);
  }

  /**
   * 分块内容
   */
  private chunkContent(content: string): Array<{
    id: string;
    content: string;
    startLine: number;
    endLine: number;
  }> {
    const CHUNK_MAX_CHARS = 1000;
    const lines = content.split('\n');
    const chunks: Array<{ id: string; content: string; startLine: number; endLine: number }> = [];

    let currentChunk = '';
    let startLine = 1;
    let lineIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLastLine = i === lines.length - 1;

      // 如果当前行加上现有内容超过限制，保存当前块并开始新块
      if (currentChunk.length + line.length > CHUNK_MAX_CHARS && currentChunk.length > 0) {
        chunks.push({
          id: crypto.randomUUID(),
          content: currentChunk.trim(),
          startLine,
          endLine: lineIndex,
        });
        currentChunk = '';
        startLine = i + 1;
      }

      currentChunk += (currentChunk ? '\n' : '') + line;
      lineIndex = i + 1;

      // 如果是最后一行，保存剩余内容
      if (isLastLine && currentChunk.trim()) {
        chunks.push({
          id: crypto.randomUUID(),
          content: currentChunk.trim(),
          startLine,
          endLine: lineIndex,
        });
      }
    }

    return chunks;
  }

  /**
   * 关闭服务
   */
  close(): void {
    this.db.close();
  }
}

// 单例实例
let fileMemoryService: FileMemoryService | null = null;

/**
 * 获取 FileMemoryService 实例
 */
export async function getFileMemoryService(): Promise<FileMemoryService> {
  if (!fileMemoryService) {
    fileMemoryService = new FileMemoryService();
    await fileMemoryService.init();
  }
  return fileMemoryService;
}

/**
 * 存储上传文件的内容
 */
export async function storeFileContent(fileId: string, content: string, filename: string): Promise<void> {
  const service = await getFileMemoryService();
  await service.addFile(fileId, content, filename);
}

/**
 * 搜索文件内容
 */
export async function searchFileContent(query: string, maxResults?: number): Promise<any[]> {
  const service = await getFileMemoryService();
  return service.search(query, maxResults);
}

/**
 * 删除文件内容
 */
export async function deleteFileContent(fileId: string, filename: string): Promise<void> {
  const service = await getFileMemoryService();
  service.deleteFile(fileId, filename);
}