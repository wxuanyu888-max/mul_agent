/**
 * Gemini Embedding Provider
 *
 * Implementation for Google's Gemini embedding API.
 */

import type { EmbeddingProvider } from '../types.js';
import { sanitizeAndNormalizeEmbedding } from './base.js';

export interface GeminiEmbeddingConfig {
  apiKey?: string;
  model?: string;
}

export interface GeminiEmbeddingClient {
  config: GeminiEmbeddingConfig;
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
}

/**
 * Create Gemini embedding provider
 */
export function createGeminiEmbeddingProvider(config: GeminiEmbeddingConfig): {
  provider: EmbeddingProvider;
  client: GeminiEmbeddingClient;
} {
  const model = config.model || 'gemini-embedding-001';
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY;

  const client: GeminiEmbeddingClient = {
    config,
    embed: async (text: string): Promise<number[]> => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: {
              role: 'user',
              parts: [{ text }],
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini embedding error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        embedding: { values: number[] };
      };

      return sanitizeAndNormalizeEmbedding(data.embedding?.values || []);
    },
    embedBatch: async (texts: string[]): Promise<number[][]> => {
      if (texts.length === 0) return [];

      // Gemini doesn't support batch embedding in the same way, so we make parallel requests
      const promises = texts.map((text) => client.embed(text));
      return Promise.all(promises);
    },
  };

  const provider: EmbeddingProvider = {
    id: 'gemini',
    model,
    embedQuery: client.embed.bind(client),
    embedBatch: client.embedBatch.bind(client),
  };

  return { provider, client };
}
