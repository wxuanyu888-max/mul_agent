/**
 * Memory Index Manager
 *
 * Core memory management system based on OpenClaw's implementation.
 * Handles vector search, full-text search, hybrid search, and file synchronization.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type {
  MemorySearchManager,
  MemorySearchResult,
  MemoryProviderStatus,
  MemoryEmbeddingProbeResult,
  MemorySyncProgressUpdate,
  MemorySource,
  MemorySearchConfig,
  EmbeddingProvider,
  HybridSource,
} from './types.js';
import { MemoryDatabase } from './database.js';
import {
  createEmbeddingProvider,
  type EmbeddingProviderOptions,
} from './embeddings/index.js';
import {
  buildFtsQuery,
  mergeHybridResults,
  type HybridVectorResult,
  type HybridKeywordResult,
} from './hybrid.js';
import { isParsableFile, parseDocument } from './parser.js';

const DEFAULT_AGENT_ID = 'core_brain';
const STORAGE_DIR = 'storage/memory';

// Chunking configuration
const CHUNK_MAX_CHARS = 1000;
const CHUNK_OVERLAP_LINES = 10;

export interface MemoryIndexManagerOptions {
  agentId: string;
  workspaceDir: string;
  config: MemorySearchConfig;
}

/**
 * Memory Index Manager
 *
 * Main class for managing memory search and indexing.
 */
export class MemoryIndexManager implements MemorySearchManager {
  private readonly agentId: string;
  private readonly workspaceDir: string;
  private readonly config: MemorySearchConfig;
  private readonly db: MemoryDatabase;
  private provider: EmbeddingProvider | null = null;

  // Cache for embeddings
  private embeddingCache: Map<string, number[]> = new Map();

  // File tracking
  private indexedFiles: Map<string, number> = new Map();

  constructor(options: MemoryIndexManagerOptions) {
    this.agentId = options.agentId;
    this.workspaceDir = options.workspaceDir;
    this.config = options.config;

    // Initialize database
    this.db = new MemoryDatabase({
      dbPath: path.join(this.workspaceDir, 'memory.db'),
      vectorEnabled: this.config.vector?.enabled ?? true,
    });
  }

  /**
   * Initialize the memory index manager
   */
  static async create(options: MemoryIndexManagerOptions): Promise<MemoryIndexManager> {
    const manager = new MemoryIndexManager(options);

    // Initialize embedding provider
    await manager.initProvider();

    return manager;
  }

  /**
   * Initialize embedding provider
   */
  private async initProvider(): Promise<void> {
    const providerOptions: EmbeddingProviderOptions = {
      provider: this.config.provider,
      model: this.config.model,
      remote: this.config.remote,
      fallback: this.config.fallback,
      local: this.config.local,
    };

    const result = await createEmbeddingProvider(providerOptions);

    if (result.provider) {
      this.provider = result.provider;
    } else {
      console.warn(
        `Embedding provider unavailable: ${result.providerUnavailableReason}`
      );
    }
  }

  /**
   * Search memories
   */
  async search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string }
  ): Promise<MemorySearchResult[]> {
    const maxResults = opts?.maxResults || 10;
    const minScore = opts?.minScore || 0;

    // Get vector and keyword results
    const vectorResults = await this.vectorSearch(query, maxResults * 2);
    const keywordResults = await this.keywordSearch(query, maxResults * 2);

    // Merge results
    const merged = await mergeHybridResults({
      vector: vectorResults,
      keyword: keywordResults,
      vectorWeight: 0.7,
      textWeight: 0.3,
    });

    // Filter by min score and limit
    return merged
      .filter((r) => r.score >= minScore)
      .slice(0, maxResults);
  }

  /**
   * Vector search
   */
  private async vectorSearch(
    query: string,
    limit: number
  ): Promise<HybridVectorResult[]> {
    if (!this.provider) {
      return [];
    }

    try {
      const embedding = await this.provider.embedQuery(query);
      const results = this.db.vectorSearch(embedding, limit);

      return results.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source as HybridSource,
        snippet: r.content.substring(0, 200),
        vectorScore: r.score,
      }));
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }

  /**
   * Keyword/Full-text search
   */
  private async keywordSearch(
    query: string,
    limit: number
  ): Promise<HybridKeywordResult[]> {
    const ftsQuery = buildFtsQuery(query);

    if (!ftsQuery) {
      return [];
    }

    try {
      const results = this.db.ftsSearch(ftsQuery, limit);

      return results.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source as HybridSource,
        snippet: r.content.substring(0, 200),
        textScore: r.rank,
      }));
    } catch (error) {
      console.error('Keyword search error:', error);
      return [];
    }
  }

  /**
   * Read a file
   */
  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }> {
    const fullPath = path.join(this.workspaceDir, params.relPath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      const startLine = params.from || 1;
      const endLine = params.lines ? startLine + params.lines - 1 : lines.length;

      const selectedLines = lines.slice(startLine - 1, endLine);

      return {
        text: selectedLines.join('\n'),
        path: params.relPath,
      };
    } catch (error) {
      throw new Error(`Failed to read file ${params.relPath}: ${error}`);
    }
  }

  /**
   * Get provider status
   */
  status(): MemoryProviderStatus {
    const chunkCount = this.db.getChunkCount();
    const sourceCounts = this.db.getSourceCounts();

    return {
      backend: 'builtin',
      provider: this.provider?.id || 'none',
      model: this.provider?.model,
      files: this.indexedFiles.size,
      chunks: chunkCount,
      dirty: false,
      workspaceDir: this.workspaceDir,
      dbPath: this.db.getDbPath(),
      sources: this.config.sources as MemorySource[],
      sourceCounts: sourceCounts.map((s) => ({
        source: s.source as MemorySource,
        files: 0,
        chunks: s.count,
      })),
      cache: {
        enabled: this.config.cache?.enabled ?? false,
        entries: this.embeddingCache.size,
        maxEntries: this.config.cache?.maxEntries,
      },
      fts: {
        enabled: true,
        available: true,
      },
      vector: {
        enabled: this.config.vector?.enabled ?? true,
        available: this.db.isVectorAvailable(),
      },
      batch: {
        enabled: this.config.batch?.enabled ?? false,
        failures: 0,
        limit: 2,
        wait: this.config.batch?.wait ?? true,
        concurrency: this.config.batch?.concurrency ?? 5,
        pollIntervalMs: this.config.batch?.pollIntervalMs ?? 1000,
        timeoutMs: this.config.batch?.timeoutMs ?? 60000,
      },
    };
  }

  /**
   * Sync memories from files
   */
  async sync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void> {
    const { progress } = params ?? {};
    const sources = this.config.sources || ['memory', 'sessions'];
    const extraPaths = this.config.extraPaths || [];

    // Get all files to index
    const filesToIndex: Array<{ path: string; source: MemorySource }> = [];

    for (const source of sources) {
      const sourceDir = path.join(this.workspaceDir, source);

      try {
        const files = await this.getFilesInDirectory(sourceDir);
        filesToIndex.push(...files.map((f) => ({ path: f, source })));
      } catch {
        // Directory might not exist
      }
    }

    // Index extra paths
    for (const extraPath of extraPaths) {
      try {
        const files = await this.getFilesInDirectory(extraPath);
        filesToIndex.push(...files.map((f) => ({ path: f, source: 'memory' as MemorySource })));
      } catch {
        // Path might not exist
      }
    }

    // Index files
    const total = filesToIndex.length;
    let completed = 0;

    for (const file of filesToIndex) {
      await this.indexFile(file.path, file.source);
      completed++;

      if (progress) {
        progress({ completed, total, label: file.path });
      }
    }
  }

  /**
   * Get files in directory recursively
   */
  private async getFilesInDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getFilesInDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && this.isIndexableFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory might not exist
    }

    return files;
  }

  /**
   * Check if file is indexable
   */
  private isIndexableFile(filename: string): boolean {
    // Use the parser's isParsableFile which supports PDF, DOC, DOCX and more
    return isParsableFile(filename);
  }

  /**
   * Index a single file
   */
  private async indexFile(filePath: string, source: MemorySource): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const mtimeMs = stats.mtimeMs;

      // Check if file needs re-indexing
      const lastIndexed = this.indexedFiles.get(filePath);
      if (lastIndexed && lastIndexed >= mtimeMs && !this.config.cache?.enabled) {
        return;
      }

      // Read file content - use parser for PDF/DOC
      let content: string;
      const ext = path.extname(filePath).toLowerCase();

      if (['.pdf', '.docx', '.doc'].includes(ext)) {
        // Use parser for PDF and DOC files
        const parsed = await parseDocument(filePath);
        content = parsed.content;
      } else {
        // Read as text for other files
        content = await fs.readFile(filePath, 'utf-8');
      }

      // Skip if no content
      if (!content || content.trim().length === 0) {
        return;
      }

      // Chunk the content
      const chunks = this.chunkContent(content, source);

      // Delete old chunks for this file
      this.db.deleteChunksByPath(filePath);

      // Insert new chunks
      for (const chunk of chunks) {
        let embedding: number[] | undefined;

        if (this.provider) {
          // Check cache
          const hash = this.getContentHash(chunk.content);
          embedding = this.embeddingCache.get(hash);

          if (!embedding) {
            try {
              embedding = await this.provider.embedQuery(chunk.content);

              // Add to cache if enabled
              if (this.config.cache?.enabled) {
                this.embeddingCache.set(hash, embedding);

                // Limit cache size
                const maxEntries = this.config.cache?.maxEntries || 1000;
                if (this.embeddingCache.size > maxEntries) {
                  const firstKey = this.embeddingCache.keys().next().value;
                  if (firstKey) {
                    this.embeddingCache.delete(firstKey);
                  }
                }
              }
            } catch (error) {
              console.error(`Failed to embed chunk: ${error}`);
            }
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

      // Update indexed files
      this.indexedFiles.set(filePath, mtimeMs);
    } catch (error) {
      console.error(`Failed to index file ${filePath}: ${error}`);
    }
  }

  /**
   * Chunk content into smaller pieces
   */
  private chunkContent(
    content: string,
    source: MemorySource
  ): Array<{
    id: string;
    content: string;
    startLine: number;
    endLine: number;
  }> {
    const lines = content.split('\n');
    const chunks: Array<{ id: string; content: string; startLine: number; endLine: number }> = [];

    let currentChunk = '';
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (currentChunk.length + line.length > CHUNK_MAX_CHARS && currentChunk.length > 0) {
        chunks.push({
          id: crypto.randomUUID(),
          content: currentChunk.trim(),
          startLine,
          endLine: i,
        });

        // Start new chunk with overlap
        const overlapStart = Math.max(0, i - CHUNK_OVERLAP_LINES);
        currentChunk = lines.slice(overlapStart, i + 1).join('\n');
        startLine = overlapStart + 1;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: crypto.randomUUID(),
        content: currentChunk.trim(),
        startLine,
        endLine: lines.length,
      });
    }

    return chunks;
  }

  /**
   * Get content hash for caching
   */
  private getContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Probe embedding availability
   */
  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    if (!this.provider) {
      return {
        ok: false,
        error: 'No embedding provider configured',
      };
    }

    try {
      await this.provider.embedQuery('test');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Probe vector availability
   */
  async probeVectorAvailability(): Promise<boolean> {
    return this.db.isVectorAvailable();
  }

  /**
   * Close the manager
   */
  async close(): Promise<void> {
    this.db.close();
    this.embeddingCache.clear();
    this.indexedFiles.clear();
  }
}

// ============================================================================
// Factory
// ============================================================================

const INDEX_CACHE = new Map<string, MemoryIndexManager>();
const INDEX_CACHE_PENDING = new Map<string, Promise<MemoryIndexManager>>();

/**
 * Get or create a MemoryIndexManager instance
 */
export async function getMemoryIndexManager(options: {
  agentId: string;
  workspaceDir: string;
  config: MemorySearchConfig;
}): Promise<MemoryIndexManager> {
  const { agentId, workspaceDir, config } = options;
  const settings = config;

  const key = `${agentId}:${workspaceDir}:${JSON.stringify(settings)}`;

  const existing = INDEX_CACHE.get(key);
  if (existing) {
    return existing;
  }

  const pending = INDEX_CACHE_PENDING.get(key);
  if (pending) {
    return pending;
  }

  const createPromise = (async () => {
    const refreshed = INDEX_CACHE.get(key);
    if (refreshed) {
      return refreshed;
    }

    const manager = await MemoryIndexManager.create({
      agentId,
      workspaceDir,
      config,
    });

    INDEX_CACHE.set(key, manager);
    return manager;
  })();

  INDEX_CACHE_PENDING.set(key, createPromise);

  try {
    return await createPromise;
  } finally {
    INDEX_CACHE_PENDING.delete(key);
  }
}
