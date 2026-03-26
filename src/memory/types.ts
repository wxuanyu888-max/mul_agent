/**
 * Memory System Types
 *
 * Complete type definitions for the memory system based on OpenClaw.
 */

// import type { DatabaseSync } from 'node:sqlite';

// ============================================================================
// Core Types
// ============================================================================

export type MemorySource = 'memory' | 'sessions';

export type MemorySearchResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: MemorySource;
  citation?: string;
};

export type MemoryEmbeddingProbeResult = {
  ok: boolean;
  error?: string;
};

export type MemorySyncProgressUpdate = {
  completed: number;
  total: number;
  label?: string;
};

// ============================================================================
// Memory Provider Status
// ============================================================================

export type MemoryProviderStatus = {
  backend: 'builtin' | 'qmd';
  provider: string;
  model?: string;
  requestedProvider?: string;
  files?: number;
  chunks?: number;
  dirty?: boolean;
  workspaceDir?: string;
  dbPath?: string;
  extraPaths?: string[];
  sources?: MemorySource[];
  sourceCounts?: Array<{ source: MemorySource; files: number; chunks: number }>;
  cache?: { enabled: boolean; entries?: number; maxEntries?: number };
  fts?: { enabled: boolean; available: boolean; error?: string };
  fallback?: { from: string; reason?: string };
  vector?: {
    enabled: boolean;
    available?: boolean;
    extensionPath?: string;
    loadError?: string;
    dims?: number;
  };
  batch?: {
    enabled: boolean;
    failures: number;
    limit: number;
    wait: boolean;
    concurrency: number;
    pollIntervalMs: number;
    timeoutMs: number;
    lastError?: string;
    lastProvider?: string;
  };
  custom?: Record<string, unknown>;
};

// ============================================================================
// Memory Search Manager Interface
// ============================================================================

export interface MemorySearchManager {
  search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ): Promise<MemorySearchResult[]>;
  readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }>;
  status(): MemoryProviderStatus;
  sync?(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void>;
  probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult>;
  probeVectorAvailability(): Promise<boolean>;
  close?(): Promise<void>;
}

// ============================================================================
// Embedding Provider Types
// ============================================================================

export type EmbeddingProviderId = 'openai' | 'local' | 'gemini' | 'voyage' | 'mistral' | 'ollama' | 'offline';
export type EmbeddingProviderRequest = EmbeddingProviderId | 'auto';
export type EmbeddingProviderFallback = EmbeddingProviderId | 'none';

export type EmbeddingProvider = {
  id: string;
  model: string;
  maxInputTokens?: number;
  embedQuery: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
};

export type EmbeddingProviderResult = {
  provider: EmbeddingProvider | null;
  requestedProvider: EmbeddingProviderRequest;
  fallbackFrom?: EmbeddingProviderId;
  fallbackReason?: string;
  providerUnavailableReason?: string;
};

export type EmbeddingProviderOptions = {
  provider: EmbeddingProviderRequest;
  model?: string;
  remote?: {
    baseUrl?: string;
    apiKey?: string;
    headers?: Record<string, string>;
  };
  fallback?: EmbeddingProviderFallback;
  local?: {
    modelPath?: string;
    modelCacheDir?: string;
  };
};

// ============================================================================
// Hybrid Search Types
// ============================================================================

export type HybridSource = string;

export type HybridVectorResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: HybridSource;
  snippet: string;
  vectorScore: number;
};

export type HybridKeywordResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: HybridSource;
  snippet: string;
  textScore: number;
};

export type MMRConfig = {
  lambda: number;
  withDiversity: boolean;
};

export type TemporalDecayConfig = {
  enabled: boolean;
  halfLifeDays: number;
  referenceDate?: string;
};

export type QueryAnalysis = {
  queryType: 'keyword' | 'semantic' | 'exact' | 'mixed';
  termCount: number;
  hasQuotes: boolean;
  hasOperators: boolean;
  isShort: boolean;
  isLong: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
};

export const DEFAULT_MMR_CONFIG: MMRConfig = {
  lambda: 0.5,
  withDiversity: true,
};

export const DEFAULT_TEMPORAL_DECAY_CONFIG: TemporalDecayConfig = {
  enabled: true,
  halfLifeDays: 90,
};

// ============================================================================
// Memory Chunk Types
// ============================================================================

export type MemoryChunk = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding?: number[];
  source: MemorySource;
  indexedAt: number;
};

// ============================================================================
// Memory File Entry
// ============================================================================

export type MemoryFileEntry = {
  path: string;
  size: number;
  mtimeMs: number;
  source: MemorySource;
};

// ============================================================================
// Configuration Types
// ============================================================================

export type MemorySearchConfig = {
  enabled: boolean;
  provider: EmbeddingProviderRequest;
  model: string;
  remote?: {
    baseUrl?: string;
    apiKey?: string;
    headers?: Record<string, string>;
  };
  fallback: EmbeddingProviderFallback;
  local?: {
    modelPath?: string;
    modelCacheDir?: string;
  };
  sources?: MemorySource[];
  extraPaths?: string[];
  vector?: {
    enabled: boolean;
    extensionPath?: string;
  };
  fts?: {
    enabled: boolean;
  };
  cache?: {
    enabled: boolean;
    maxEntries?: number;
  };
  batch?: {
    enabled: boolean;
    wait: boolean;
    concurrency: number;
    pollIntervalMs: number;
    timeoutMs: number;
  };
  // New: Reranker configuration
  reranker?: {
    enabled: boolean;
    provider: 'ollama' | 'openai' | 'bm25';
    model?: string;
    topK?: number;
  };
  // New: Query rewriting
  queryRewrite?: {
    enabled: boolean;
    maxVariations?: number;
  };
  // New: Dynamic weights
  dynamicWeights?: {
    enabled: boolean;
  };
};

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface WriteMemoryRequest {
  content: string;
  agent_id?: string;
  memory_type?: 'short_term' | 'long_term' | 'handover';
  metadata?: Record<string, unknown>;
}

export interface WriteMemoryResponse {
  status: string;
  memory_id: string;
  path: string;
}

export interface SearchMemoryRequest {
  query: string;
  agent_id?: string;
  memory_type?: 'short_term' | 'long_term' | 'handover';
  limit?: number;
}

export interface SearchMemoryResponse {
  query: string;
  results: Array<{
    memory_id: string;
    relevance: number;
    content: {
      key?: string;
      value: string;
      metadata?: Record<string, unknown>;
    };
    created_at: string;
  }>;
  total: number;
}

export interface MemoryStats {
  agent_id: string;
  stats: Record<string, unknown>;
}

export interface MemorySummary {
  status: string;
  memory_type: string;
  memory_count: number;
  topics: string[];
}

// ============================================================================
// Database Types
// ============================================================================

export interface VectorTableRow {
  id: string;
  path: string;
  start_line: number;
  end_line: number;
  content: string;
  embedding: number[];
  source: string;
  indexed_at: number;
}

export interface FTSTableRow {
  id: string;
  path: string;
  start_line: number;
  end_line: number;
  content: string;
  source: string;
  indexed_at: number;
}

export interface EmbeddingCacheRow {
  hash: string;
  content: string;
  embedding: number[];
  created_at: number;
}
