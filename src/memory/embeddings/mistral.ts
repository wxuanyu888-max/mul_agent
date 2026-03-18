/**
 * Mistral AI Embedding Provider
 *
 * Implementation for Mistral AI's embedding API.
 */

import type { EmbeddingProvider } from '../types.js';
import { sanitizeAndNormalizeEmbedding, getDefaultEmbeddingModel } from './base.js';

export interface MistralEmbeddingConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export interface MistralEmbeddingClient {
  config: MistralEmbeddingConfig;
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
}

/**
 * Create Mistral embedding provider
 */
export function createMistralEmbeddingProvider(config: MistralEmbeddingConfig): {
  provider: EmbeddingProvider;
  client: MistralEmbeddingClient;
} {
  const model = config.model || getDefaultEmbeddingModel('mistral');
  const baseURL = config.baseURL || 'https://api.mistral.ai/v1';
  const apiKey = config.apiKey || process.env.MISTRAL_API_KEY;

  const client: MistralEmbeddingClient = {
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
        throw new Error(`Mistral embedding error: ${response.status} - ${error}`);
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
        throw new Error(`Mistral embedding error: ${response.status} - ${error}`);
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
    id: 'mistral',
    model,
    embedQuery: client.embed.bind(client),
    embedBatch: client.embedBatch.bind(client),
  };

  return { provider, client };
}
