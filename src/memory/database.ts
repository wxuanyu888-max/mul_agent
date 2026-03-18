/**
 * Database Layer
 *
 * SQLite database with vector search support using sqlite-vec.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

const VECTOR_TABLE = 'chunks_vec';
const FTS_TABLE = 'chunks_fts';
const EMBEDDING_CACHE_TABLE = 'embedding_cache';

export interface DatabaseConfig {
  dbPath: string;
  vectorEnabled?: boolean;
}

/**
 * Initialize a memory database with vector and FTS support
 */
export class MemoryDatabase {
  private db: DatabaseSync;
  private dbPath: string;
  private vectorEnabled: boolean;

  constructor(config: DatabaseConfig) {
    this.dbPath = config.dbPath;
    this.vectorEnabled = config.vectorEnabled ?? true;
    this.db = this.openDatabase();
  }

  private openDatabase(): DatabaseSync {
    // Dynamic import for node:sqlite
    let sqlite: typeof import('node:sqlite');
    try {
      sqlite = require('node:sqlite');
    } catch {
      throw new Error('SQLite support requires Node.js 22+ with --experimental-sqlite or use a polyfill');
    }

    const db = new sqlite.DatabaseSync(this.dbPath);

    // Enable WAL mode for better performance
    db.exec('PRAGMA journal_mode=WAL;');

    // Create tables
    this.createTables(db);

    return db;
  }

  private createTables(db: DatabaseSync): void {
    // Main chunks table (without vector column if vec extension not available)
    if (this.vectorEnabled) {
      try {
        // Try to load sqlite-vec extension
        db.exec(`
          CREATE TABLE IF NOT EXISTS ${VECTOR_TABLE} (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding REAL[],
            source TEXT NOT NULL,
            indexed_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_chunks_path ON ${VECTOR_TABLE}(path);
          CREATE INDEX IF NOT EXISTS idx_chunks_source ON ${VECTOR_TABLE}(source);
        `);
      } catch {
        // Fallback to table without vector column
        this.vectorEnabled = false;
        this.createTablesWithoutVector(db);
      }
    } else {
      this.createTablesWithoutVector(db);
    }

    // FTS5 table for full-text search
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
          id,
          path,
          content,
          source,
          content=${VECTOR_TABLE},
          content_rowid='rowid'
        );
      `);

      // Triggers to keep FTS in sync
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS ${VECTOR_TABLE}_ai AFTER INSERT ON ${VECTOR_TABLE} BEGIN
          INSERT INTO ${FTS_TABLE}(id, path, content, source)
          VALUES (new.id, new.path, new.content, new.source);
        END;

        CREATE TRIGGER IF NOT EXISTS ${VECTOR_TABLE}_ad AFTER DELETE ON ${VECTOR_TABLE} BEGIN
          INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, id, path, content, source)
          VALUES ('delete', old.id, old.path, old.content, old.source);
        END;

        CREATE TRIGGER IF NOT EXISTS ${VECTOR_TABLE}_au AFTER UPDATE ON ${VECTOR_TABLE} BEGIN
          INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, id, path, content, source)
          VALUES ('delete', old.id, old.path, old.content, old.source);
          INSERT INTO ${FTS_TABLE}(id, path, content, source)
          VALUES (new.id, new.path, new.content, new.source);
        END;
      `);
    } catch {
      // FTS might not be available
      console.warn('FTS5 not available, falling back to basic search');
    }

    // Embedding cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${EMBEDDING_CACHE_TABLE} (
        hash TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding REAL[],
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_embedding_cache_created
        ON ${EMBEDDING_CACHE_TABLE}(created_at);
    `);
  }

  private createTablesWithoutVector(db: DatabaseSync): void {
    // Basic table without vector column
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${VECTOR_TABLE} (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        indexed_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_path ON ${VECTOR_TABLE}(path);
      CREATE INDEX IF NOT EXISTS idx_chunks_source ON ${VECTOR_TABLE}(source);
    `);
  }

  /**
   * Insert a chunk into the database
   */
  insertChunk(chunk: {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    embedding?: number[];
    source: string;
    indexedAt: number;
  }): void {
    if (this.vectorEnabled && chunk.embedding) {
      const stmt = this.db.prepare(
        `INSERT OR REPLACE INTO ${VECTOR_TABLE}
         (id, path, start_line, end_line, content, embedding, source, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      // Convert embedding to Float64Array for SQLite
      const embeddingBuffer = Buffer.from(new Float64Array(chunk.embedding).buffer);
      stmt.run(chunk.id, chunk.path, chunk.startLine, chunk.endLine, chunk.content, embeddingBuffer, chunk.source, chunk.indexedAt);
    } else {
      const stmt = this.db.prepare(
        `INSERT OR REPLACE INTO ${VECTOR_TABLE}
         (id, path, start_line, end_line, content, source, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run(chunk.id, chunk.path, chunk.startLine, chunk.endLine, chunk.content, chunk.source, chunk.indexedAt);
    }
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

    try {
      const stmt = this.db.prepare(
        `SELECT id, path, start_line, end_line, content, source,
                vec_distance_cosine(embedding, ?) as distance
         FROM ${VECTOR_TABLE}
         ORDER BY distance ASC
         LIMIT ?`
      );
      // Convert embedding to Float64Array for SQLite
      const embeddingBuffer = Buffer.from(new Float64Array(embedding).buffer);
      const results = stmt.all(embeddingBuffer, limit) as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        content: string;
        source: string;
        distance: number;
      }>;

      return results.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.start_line,
        endLine: r.end_line,
        content: r.content,
        source: r.source,
        score: 1 - r.distance, // Convert distance to similarity
      }));
    } catch {
      return [];
    }
  }

  /**
   * Full-text search
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
    try {
      const stmt = this.db.prepare(
        `SELECT c.id, c.path, c.start_line, c.end_line, c.content, c.source,
                f.rank
         FROM ${FTS_TABLE} f
         JOIN ${VECTOR_TABLE} c ON f.id = c.id
         WHERE ${FTS_TABLE} MATCH ?
         ORDER BY rank
         LIMIT ?`
      );
      const results = stmt.all(query, limit) as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        content: string;
        source: string;
        rank: number;
      }>;

      return results.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.start_line,
        endLine: r.end_line,
        content: r.content,
        source: r.source,
        rank: r.rank,
      }));
    } catch {
      // Fallback to LIKE search if FTS fails
      return this.likeSearch(query, limit);
    }
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
    const searchPattern = `%${query}%`;
    const stmt = this.db.prepare(
      `SELECT id, path, start_line, end_line, content, source
       FROM ${VECTOR_TABLE}
       WHERE content LIKE ?
       LIMIT ?`
    );
    const results = stmt.all(searchPattern, limit) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      content: string;
      source: string;
    }>;

    return results.map((r, i) => ({
      id: r.id,
      path: r.path,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content,
      source: r.source,
      rank: i + 1,
    }));
  }

  /**
   * Get embedding cache
   */
  getCachedEmbedding(contentHash: string): number[] | null {
    const stmt = this.db.prepare(
      `SELECT embedding FROM ${EMBEDDING_CACHE_TABLE} WHERE hash = ?`
    );
    const result = stmt.get(contentHash) as unknown as { embedding: number[] } | undefined;
    return result?.embedding || null;
  }

  /**
   * Cache embedding
   */
  cacheEmbedding(contentHash: string, content: string, embedding: number[]): void {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${EMBEDDING_CACHE_TABLE}
       (hash, content, embedding, created_at)
       VALUES (?, ?, ?, ?)`
    );
    // Convert embedding to Float64Array for SQLite
    const embeddingBuffer = Buffer.from(new Float64Array(embedding).buffer);
    stmt.run(contentHash, content, embeddingBuffer, Date.now());
  }

  /**
   * Get chunk by ID
   */
  getChunk(id: string): {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    source: string;
    indexedAt: number;
  } | null {
    const stmt = this.db.prepare(
      `SELECT * FROM ${VECTOR_TABLE} WHERE id = ?`
    );
    const result = stmt.get(id) as {
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      content: string;
      source: string;
      indexed_at: number;
    } | undefined;

    if (!result) return null;

    return {
      id: result.id,
      path: result.path,
      startLine: result.start_line,
      endLine: result.end_line,
      content: result.content,
      source: result.source,
      indexedAt: result.indexed_at,
    };
  }

  /**
   * Get chunks by path
   */
  getChunksByPath(pathPattern: string): Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    source: string;
    indexedAt: number;
  }> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${VECTOR_TABLE} WHERE path LIKE ?`
    );
    const results = stmt.all(pathPattern) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      content: string;
      source: string;
      indexed_at: number;
    }>;

    return results.map((r) => ({
      id: r.id,
      path: r.path,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content,
      source: r.source,
      indexedAt: r.indexed_at,
    }));
  }

  /**
   * Delete chunk by ID
   */
  deleteChunk(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE id = ?`);
    stmt.run(id);
  }

  /**
   * Delete chunks by path
   */
  deleteChunksByPath(pathPattern: string): void {
    const stmt = this.db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE path LIKE ?`);
    stmt.run(pathPattern);
  }

  /**
   * Get all chunks
   */
  getAllChunks(): Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    source: string;
    indexedAt: number;
  }> {
    const stmt = this.db.prepare(`SELECT * FROM ${VECTOR_TABLE}`);
    const results = stmt.all() as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      content: string;
      source: string;
      indexed_at: number;
    }>;

    return results.map((r) => ({
      id: r.id,
      path: r.path,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content,
      source: r.source,
      indexedAt: r.indexed_at,
    }));
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${VECTOR_TABLE}`);
    const result = stmt.get() as { count: number } | undefined;
    return result?.count || 0;
  }

  /**
   * Get source counts
   */
  getSourceCounts(): Array<{ source: string; count: number }> {
    const stmt = this.db.prepare(
      `SELECT source, COUNT(*) as count FROM ${VECTOR_TABLE} GROUP BY source`
    );
    const results = stmt.all() as Array<{ source: string; count: number }>;
    return results;
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
   * Close the database
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create a database instance
 */
export async function createMemoryDatabase(
  workspaceDir: string,
  vectorEnabled: boolean = true
): Promise<MemoryDatabase> {
  // Ensure directory exists
  await fs.mkdir(workspaceDir, { recursive: true });

  const dbPath = path.join(workspaceDir, 'memory.db');
  return new MemoryDatabase({ dbPath, vectorEnabled });
}
