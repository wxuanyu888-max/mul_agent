/**
 * Memory System
 *
 * Complete memory management system based on OpenClaw's architecture.
 * Supports vector search, full-text search, hybrid search, and multiple embedding providers.
 */

// Types
export * from './types.js';

// Parser
export {
  parseDocument,
  extractText,
  isParsableFile,
  getDocumentType,
  type ParsedDocument,
  type DocumentType,
} from './parser.js';

// Database
export { MemoryDatabase, createMemoryDatabase } from './database.js';

// Embeddings
export {
  createEmbeddingProvider,
  createOpenAIEmbeddingProvider,
  createVoyageEmbeddingProvider,
  createGeminiEmbeddingProvider,
  createMistralEmbeddingProvider,
  createOllamaEmbeddingProvider,
  createOfflineEmbeddingProvider,
  listOllamaModels,
  sanitizeAndNormalizeEmbedding,
  getDefaultEmbeddingModel,
  DEFAULT_EMBEDDING_MODELS,
} from './embeddings/index.js';

export type {
  OpenAIEmbeddingConfig,
  VoyageEmbeddingConfig,
  GeminiEmbeddingConfig,
  MistralEmbeddingConfig,
  OllamaEmbeddingConfig,
} from './embeddings/index.js';

// Hybrid Search
export {
  buildFtsQuery,
  bm25RankToScore,
  applyMMRToHybridResults,
  applyTemporalDecayToHybridResults,
  mergeHybridResults,
  DEFAULT_MMR_CONFIG,
  DEFAULT_TEMPORAL_DECAY_CONFIG,
} from './hybrid.js';

// Manager
export { MemoryIndexManager, getMemoryIndexManager } from './manager.js';

// Unified Memory System
export {
  UnifiedMemoryManager,
  createUnifiedMemoryManager,
  MemoryTier,
  DEFAULT_UNIFIED_MEMORY_CONFIG,
  type UnifiedMemoryConfig,
  type MemoryItem,
  type ShortMemoryConfig,
  type RemoteMemoryConfig,
  type VectorMemoryConfig,
  type WorkspaceConfig,
} from './unified.js';

// Routes
export { createMemoryRouter } from './routes.js';

// Team Memory
export {
  getTeamMemoryManager,
  teamMemoryWrite,
  teamMemoryRead,
  teamMemoryList,
  teamMemoryListByAgent,
  teamMemoryDelete,
  teamMemoryCleanup,
  teamMemoryStats,
  type TeamMemoryEntry,
} from './team.js';
