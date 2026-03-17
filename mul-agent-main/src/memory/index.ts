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

// Routes
export { createMemoryRouter } from './routes.js';
