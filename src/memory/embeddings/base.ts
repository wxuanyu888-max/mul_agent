/**
 * Embedding Provider Base
 *
 * Base types and utilities for embedding providers.
 */

import type { EmbeddingProvider, EmbeddingProviderResult } from './types.js';

/**
 * Create a sanitized and normalized embedding vector
 */
export function sanitizeAndNormalizeEmbedding(vec: number[]): number[] {
  const sanitized = vec.map((value) => (Number.isFinite(value) ? value : 0));
  const magnitude = Math.sqrt(sanitized.reduce((sum, value) => sum + value * value, 0));
  if (magnitude < 1e-10) {
    return sanitized;
  }
  return sanitized.map((value) => value / magnitude);
}

/**
 * Default embedding models
 */
export const DEFAULT_EMBEDDING_MODELS = {
  openai: 'text-embedding-3-small',
  voyage: 'voyage-law-2',
  mistral: 'mistral-embed',
  gemini: 'gemini-embedding-001',
} as const;

/**
 * Get default model for provider
 */
export function getDefaultEmbeddingModel(provider: string): string {
  return DEFAULT_EMBEDDING_MODELS[provider as keyof typeof DEFAULT_EMBEDDING_MODELS] || 'text-embedding-3-small';
}

export type { EmbeddingProvider, EmbeddingProviderResult };
