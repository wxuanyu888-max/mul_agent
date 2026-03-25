/**
 * Database Layer - In-Memory Storage with JSON Persistence
 *
 * Fallback implementation using JavaScript Maps when SQLite is unavailable.
 * Supports vector search using cosine similarity and full-text search using inverted index.
 * Data is persisted to JSON file for survival across restarts.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface DatabaseConfig {
  dbPath: string;
  vectorEnabled?: boolean;
}

// In-memory storage types
interface ChunkData {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding?: number[];
  source: string;
  indexedAt: number;
}

// Persistence file interface
interface PersistedData {
  version: number;
  chunks: ChunkData[];
  updatedAt: number;
}

/**
 * In-Memory Database with vector and FTS support
 */
export class MemoryDatabase {
  // Main storage
  private chunks: Map<string, ChunkData> = new Map();
  private chunksByPath: Map<string, ChunkData[]> = new Map();
  private embeddingCache: Map<string, { content: string; embedding: number[]; createdAt: number }> = new Map();

  // FTS inverted index: word -> Set of chunk IDs
  private ftsIndex: Map<string, Set<string>> = new Map();

  private dbPath: string;
  private jsonPath: string;
  private vectorEnabled: boolean;
  private dirty: boolean = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(config: DatabaseConfig) {
    this.dbPath = config.dbPath;
    this.vectorEnabled = config.vectorEnabled ?? true;

    // Handle path - if it's already absolute, use it; otherwise prepend storage/
    let jsonPath = config.dbPath.replace('.db', '.json');
    if (!path.isAbsolute(jsonPath)) {
      jsonPath = path.join('storage', jsonPath);
    }
    this.jsonPath = path.resolve(jsonPath);

    // Load persisted data on startup
    this.loadFromDisk();

    console.log('[MemoryDB] Using in-memory storage with JSON persistence');
    console.log('[MemoryDB] JSON path:', this.jsonPath);
  }

  /**
   * Load data from JSON file
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.jsonPath, 'utf-8');
      const parsed: PersistedData = JSON.parse(data);

      if (parsed.chunks && Array.isArray(parsed.chunks)) {
        for (const chunk of parsed.chunks) {
          this.chunks.set(chunk.id, chunk);

          if (!this.chunksByPath.has(chunk.path)) {
            this.chunksByPath.set(chunk.path, []);
          }
          this.chunksByPath.get(chunk.path)!.push(chunk);

          // Rebuild FTS index
          this.updateFtsIndex(chunk);
        }
        console.log(`[MemoryDB] Loaded ${this.chunks.size} chunks from disk`);
      }
    } catch {
      // No persisted data yet, start fresh
      console.log('[MemoryDB] No persisted data found, starting fresh');
    }
  }

  /**
   * Save data to JSON file (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce saves to avoid excessive disk writes
    this.saveTimeout = setTimeout(async () => {
      await this.saveToDisk();
    }, 2000);
  }

  /**
   * Save data to JSON file immediately
   */
  private async saveToDisk(): Promise<void> {
    if (!this.dirty) return;

    try {
      const data: PersistedData = {
        version: 1,
        chunks: Array.from(this.chunks.values()),
        updatedAt: Date.now(),
      };

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.jsonPath), { recursive: true });
      await fs.writeFile(this.jsonPath, JSON.stringify(data, null, 2), 'utf-8');

      this.dirty = false;
      console.log(`[MemoryDB] Saved ${this.chunks.size} chunks to disk`);
    } catch (error) {
      console.error('[MemoryDB] Failed to save to disk:', error);
    }
  }

  /**
   * Tokenize text for FTS
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  /**
   * Update FTS index for a chunk
   */
  private updateFtsIndex(chunk: ChunkData): void {
    const words = this.tokenize(chunk.content);
    for (const word of words) {
      if (!this.ftsIndex.has(word)) {
        this.ftsIndex.set(word, new Set());
      }
      this.ftsIndex.get(word)!.add(chunk.id);
    }
  }

  /**
   * Remove chunk from FTS index
   */
  private removeFromFtsIndex(chunkId: string, content: string): void {
    const words = this.tokenize(content);
    for (const word of words) {
      const ids = this.ftsIndex.get(word);
      if (ids) {
        ids.delete(chunkId);
        if (ids.size === 0) {
          this.ftsIndex.delete(word);
        }
      }
    }
  }

  /**
   * Insert a chunk into the database
   */
  insertChunk(chunk: ChunkData): void {
    // Remove old version if exists
    const oldChunk = this.chunks.get(chunk.id);
    if (oldChunk) {
      this.removeFromFtsIndex(oldChunk.id, oldChunk.content);
      const pathChunks = this.chunksByPath.get(oldChunk.path);
      if (pathChunks) {
        const idx = pathChunks.findIndex(c => c.id === chunk.id);
        if (idx >= 0) pathChunks.splice(idx, 1);
      }
    }

    // Add new chunk
    this.chunks.set(chunk.id, chunk);

    // Index by path
    if (!this.chunksByPath.has(chunk.path)) {
      this.chunksByPath.set(chunk.path, []);
    }
    this.chunksByPath.get(chunk.path)!.push(chunk);

    // Update FTS index
    this.updateFtsIndex(chunk);

    // Mark dirty and schedule save
    this.dirty = true;
    this.scheduleSave();
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Vector search - find similar chunks
   */
  vectorSearch(embedding: number[], limit: number = 10): Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    source: string;
    score: number;
  }> {
    if (!this.vectorEnabled) {
      return [];
    }

    const results: Array<{ chunk: ChunkData; score: number }> = [];

    for (const chunk of this.chunks.values()) {
      if (chunk.embedding && chunk.embedding.length === embedding.length) {
        const score = this.cosineSimilarity(embedding, chunk.embedding);
        results.push({ chunk, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit).map(r => ({
      id: r.chunk.id,
      path: r.chunk.path,
      startLine: r.chunk.startLine,
      endLine: r.chunk.endLine,
      content: r.chunk.content,
      source: r.chunk.source,
      score: r.score,
    }));
  }

  /**
   * Full-text search using inverted index
   */
  ftsSearch(query: string, limit: number = 10): Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    source: string;
    rank: number;
  }> {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return [];

    // Find chunks that match any query word
    const matchingChunkIds = new Set<string>();
    for (const word of queryWords) {
      const ids = this.ftsIndex.get(word);
      if (ids) {
        for (const id of ids) {
          matchingChunkIds.add(id);
        }
      }
    }

    // Score and rank results
    const results: Array<{ chunk: ChunkData; rank: number }> = [];
    for (const id of matchingChunkIds) {
      const chunk = this.chunks.get(id);
      if (chunk) {
        // Count how many query words appear in the chunk
        const chunkWords = new Set(this.tokenize(chunk.content));
        let matchCount = 0;
        for (const word of queryWords) {
          if (chunkWords.has(word)) matchCount++;
        }
        results.push({ chunk, rank: matchCount });
      }
    }

    // Sort by rank descending
    results.sort((a, b) => b.rank - a.rank);

    return results.slice(0, limit).map(r => ({
      id: r.chunk.id,
      path: r.chunk.path,
      startLine: r.chunk.startLine,
      endLine: r.chunk.endLine,
      content: r.chunk.content,
      source: r.chunk.source,
      rank: r.rank,
    }));
  }

  /**
   * Basic LIKE search as fallback
   */
  likeSearch(query: string, limit: number = 10): Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    source: string;
    rank: number;
  }> {
    const queryLower = query.toLowerCase();
    const results: Array<{ chunk: ChunkData; rank: number }> = [];

    for (const chunk of this.chunks.values()) {
      if (chunk.content.toLowerCase().includes(queryLower)) {
        results.push({ chunk, rank: 1 });
      }
    }

    return results.slice(0, limit).map((r, i) => ({
      id: r.chunk.id,
      path: r.chunk.path,
      startLine: r.chunk.startLine,
      endLine: r.chunk.endLine,
      content: r.chunk.content,
      source: r.chunk.source,
      rank: i + 1,
    }));
  }

  /**
   * Get embedding cache
   */
  getCachedEmbedding(contentHash: string): number[] | null {
    const cached = this.embeddingCache.get(contentHash);
    return cached?.embedding || null;
  }

  /**
   * Cache embedding
   */
  cacheEmbedding(contentHash: string, content: string, embedding: number[]): void {
    this.embeddingCache.set(contentHash, {
      content,
      embedding,
      createdAt: Date.now(),
    });
  }

  /**
   * Get chunk by ID
   */
  getChunk(id: string): ChunkData | null {
    return this.chunks.get(id) || null;
  }

  /**
   * Get chunks by path
   */
  getChunksByPath(pathPattern: string): ChunkData[] {
    const results: ChunkData[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.path.includes(pathPattern) || pathPattern === '*') {
        results.push(chunk);
      }
    }
    return results;
  }

  /**
   * Delete chunk by ID
   */
  deleteChunk(id: string): void {
    const chunk = this.chunks.get(id);
    if (chunk) {
      this.removeFromFtsIndex(chunk.id, chunk.content);
      const pathChunks = this.chunksByPath.get(chunk.path);
      if (pathChunks) {
        const idx = pathChunks.findIndex(c => c.id === id);
        if (idx >= 0) pathChunks.splice(idx, 1);
      }
      this.chunks.delete(id);
      this.dirty = true;
      this.scheduleSave();
    }
  }

  /**
   * Delete chunks by path
   */
  deleteChunksByPath(pathPattern: string): void {
    const toDelete: string[] = [];
    for (const [id, chunk] of this.chunks) {
      if (chunk.path.includes(pathPattern)) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      this.deleteChunk(id);
    }
  }

  /**
   * Get all chunks
   */
  getAllChunks(): ChunkData[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.size;
  }

  /**
   * Get source counts
   */
  getSourceCounts(): Array<{ source: string; count: number }> {
    const counts = new Map<string, number>();
    for (const chunk of this.chunks.values()) {
      counts.set(chunk.source, (counts.get(chunk.source) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([source, count]) => ({ source, count }));
  }

  /**
   * Check if vector is available
   */
  isVectorAvailable(): boolean {
    return this.vectorEnabled;
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Close the database - save data first
   */
  async close(): Promise<void> {
    // Save any pending data before closing
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    await this.saveToDisk();

    this.chunks.clear();
    this.chunksByPath.clear();
    this.embeddingCache.clear();
    this.ftsIndex.clear();
    console.log('[MemoryDB] Database closed');
  }
}

/**
 * Create a database instance
 */
export async function createMemoryDatabase(
  workspaceDir: string,
  vectorEnabled: boolean = true
): Promise<MemoryDatabase> {
  const dbPath = `${workspaceDir}/memory.db`;
  return new MemoryDatabase({ dbPath, vectorEnabled });
}
