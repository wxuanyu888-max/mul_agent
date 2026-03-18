/**
 * Voyage AI Embedding Provider
 *
 * Implementation for Voyage AI's embedding API.
 */

import type { EmbeddingProvider } from '../types.js';
import { sanitizeAndNormalizeEmbedding, getDefaultEmbeddingModel } from './base.js';

export interface VoyageEmbeddingConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export interface VoyageEmbeddingClient {
  config: VoyageEmbeddingConfig;
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
}

/**
 * Create Voyage AI embedding provider
 */
export function createVoyageEmbeddingProvider(config: VoyageEmbeddingConfig): {
  provider: EmbeddingProvider;
  client: VoyageEmbeddingClient;
} {
  const model = config.model || getDefaultEmbeddingModel('voyage');
  const baseURL = config.baseURL || 'https://api.voyageai.com/v1';
  const apiKey = config.apiKey || process.env.VOYAGE_API_KEY;

  const client: VoyageEmbeddingClient = {
    config,
    embed: async (text: string): Promise<number[]> => {
      const response = await fetch(`${baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Voyage embedding error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
      };

      return sanitizeAndNormalizeEmbedding(data.data[0]?.embedding || []);
    },
    embedBatch: async (texts: string[]): Promise<number[][]> => {
      if (texts.length === 0) return [];

      const response = await fetch(`${baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
          model,
          input: texts,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Voyage embedding error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      // Sort by index to maintain order
      const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return sorted.map((item) => sanitizeAndNormalizeEmbedding(item.embedding));
    },
  };

  const provider: EmbeddingProvider = {
    id: 'voyage',
    model,
    embedQuery: client.embed.bind(client),
    embedBatch: client.embedBatch.bind(client),
  };

  return { provider, client };
}
