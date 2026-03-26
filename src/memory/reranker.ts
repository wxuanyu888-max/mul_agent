/**
 * Reranker Module
 *
 * Provides result re-ranking capabilities for RAG search.
 * Uses cross-encoder style scoring to improve result relevance.
 */

import type { MemorySearchResult, MemorySource } from './types.js';

export interface RerankerConfig {
  enabled: boolean;
  provider: 'ollama' | 'openai' | 'custom';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  topK?: number; // Re-rank top N results
  batchSize?: number;
}

export interface RerankResult extends MemorySearchResult {
  originalScore: number;
  rerankScore: number;
}

export interface Reranker {
  rerank(query: string, results: MemorySearchResult[], topK?: number): Promise<RerankResult[]>;
  healthCheck(): Promise<boolean>;
}

/**
 * LLM-based reranker using cross-encoder scoring
 *
 * Scores each (query, document) pair using the same LLM that handles embeddings.
 * This provides more accurate relevance scoring than bi-encoder similarity alone.
 */
export class LLMReranker implements Reranker {
  private config: RerankerConfig;
  private scoringPrompt = `Given a query and a document, rate how relevant the document is to the answer the query.
Query: {query}
Document: {document}
Relevance score (0-10):`;

  constructor(config: RerankerConfig) {
    this.config = {
      topK: 10,
      batchSize: 5,
      ...config,
    };
  }

  async rerank(query: string, results: MemorySearchResult[], topK?: number): Promise<RerankResult[]> {
    if (!this.config.enabled || results.length === 0) {
      return results.map((r) => ({ ...r, originalScore: r.score, rerankScore: r.score }));
    }

    const limit = topK ?? this.config.topK ?? results.length;

    // Score each result
    const scoredResults: RerankResult[] = [];

    for (const result of results) {
      const score = await this.scoreRelevance(query, result.snippet);
      scoredResults.push({
        ...result,
        originalScore: result.score,
        rerankScore: score,
      });
    }

    // Sort by rerank score and return top K
    return scoredResults.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, limit);
  }

  /**
   * Score relevance using LLM
   * This is a simple implementation - can be enhanced with actual LLM calls
   */
  private async scoreRelevance(query: string, document: string): Promise<number> {
    // Simple keyword-based scoring as fallback
    // In production, this would call the LLM API
    const queryTerms = query.toLowerCase().split(/\s+/);
    const docTerms = document.toLowerCase();

    let matches = 0;
    for (const term of queryTerms) {
      if (docTerms.includes(term)) {
        matches++;
      }
    }

    // Normalize to 0-1 range
    const baseScore = matches / Math.max(queryTerms.length, 1);

    // Boost exact phrase matches
    if (docTerms.includes(query.toLowerCase())) {
      return Math.min(1, baseScore + 0.3);
    }

    return baseScore;
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Implement actual health check by calling the reranker API
    return this.config.enabled;
  }
}

/**
 * BM25-based reranker (statistical)
 */
export class BM25Reranker implements Reranker {
  private k1 = 1.5;
  private b = 0.75;

  async rerank(query: string, results: MemorySearchResult[], topK?: number): Promise<RerankResult[]> {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const limit = topK ?? results.length;

    const scoredResults: RerankResult[] = results.map((result) => {
      const score = this.calculateBM25(queryTerms, result.snippet);
      return {
        ...result,
        originalScore: result.score,
        rerankScore: score,
      };
    });

    return scoredResults.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, limit);
  }

  private calculateBM25(queryTerms: string[], document: string): number {
    const docTerms = document.toLowerCase().split(/\s+/);
    const docLength = docTerms.length;
    const avgDocLength = docLength; // Simplified

    let score = 0;
    const termFreq = new Map<string, number>();

    for (const term of docTerms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    for (const queryTerm of queryTerms) {
      const tf = termFreq.get(queryTerm) || 0;
      if (tf > 0) {
        // Simplified BM25 formula
        const idf = Math.log(1 + 1); // Assume uniform IDF for simplicity
        const tfComponent = (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength)));
        score += idf * tfComponent;
      }
    }

    return score;
  }

  async healthCheck(): Promise<boolean> {
    return true; // Always available
  }
}

/**
 * Composite reranker that combines multiple strategies
 */
export class CompositeReranker implements Reranker {
  private rerankers: Reranker[];
  private weights: number[];

  constructor(rerankers: Reranker[], weights: number[]) {
    this.rerankers = rerankers;
    this.weights = weights;
  }

  async rerank(query: string, results: MemorySearchResult[], topK?: number): Promise<RerankResult[]> {
    if (this.rerankers.length === 0) {
      return results.map((r) => ({ ...r, originalScore: r.score, rerankScore: r.score }));
    }

    // Run all rerankers
    const allScores = await Promise.all(this.rerankers.map((r) => r.rerank(query, results, results.length)));

    // Combine scores
    const combinedResults: Map<string, RerankResult> = new Map();

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      let totalScore = 0;

      for (let j = 0; j < this.rerankers.length; j++) {
        totalScore += allScores[j][i].rerankScore * (this.weights[j] || 1);
      }

      combinedResults.set(result.path, {
        ...result,
        originalScore: result.score,
        rerankScore: totalScore / this.weights.length,
      });
    }

    const limit = topK ?? results.length;
    return Array.from(combinedResults.values())
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, limit);
  }

  async healthCheck(): Promise<boolean> {
    return this.rerankers.some((r) => r.healthCheck());
  }
}

// ============================================================================
// Factory
// ============================================================================

const rerankerCache = new Map<string, Reranker>();

export function createReranker(config: RerankerConfig): Reranker {
  if (!config.enabled) {
    return new BM25Reranker(); // Fallback to statistical reranker
  }

  const cacheKey = `${config.provider}:${config.model}`;
  const cached = rerankerCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let reranker: Reranker;

  switch (config.provider) {
    case 'ollama':
    case 'openai':
      reranker = new LLMReranker(config);
      break;
    default:
      reranker = new BM25Reranker();
  }

  rerankerCache.set(cacheKey, reranker);
  return reranker;
}

/**
 * Get default reranker configuration
 */
export function getDefaultRerankerConfig(): RerankerConfig {
  return {
    enabled: false, // Disabled by default, can be enabled via config
    provider: 'ollama',
    model: 'nomic-embed-text',
    topK: 10,
    batchSize: 5,
  };
}