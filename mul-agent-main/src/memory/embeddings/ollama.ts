/**
 * Ollama Embedding Provider
 *
 * Implementation for Ollama's local embedding API.
 */

import type { EmbeddingProvider } from '../types.js';
import { sanitizeAndNormalizeEmbedding } from './base.js';

export interface OllamaEmbeddingConfig {
  baseURL?: string;
  model?: string;
}

export interface OllamaEmbeddingClient {
  config: OllamaEmbeddingConfig;
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
}

/**
 * Create Ollama embedding provider
 */
export function createOllamaEmbeddingProvider(config: OllamaEmbeddingConfig): {
  provider: EmbeddingProvider;
  client: OllamaEmbeddingClient;
} {
  const model = config.model || 'nomic-embed-text';
  const baseURL = config.baseURL || 'http://localhost:11434';

  const client: OllamaEmbeddingClient = {
    config,
    embed: async (text: string): Promise<number[]> => {
      const response = await fetch(`${baseURL}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama embedding error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        embedding: number[];
      };

      return sanitizeAndNormalizeEmbedding(data.embedding || []);
    },
    embedBatch: async (texts: string[]): Promise<number[][]> => {
      if (texts.length === 0) return [];

      // Ollama doesn't have a batch API, so we make parallel requests
      const promises = texts.map((text) => client.embed(text));
      return Promise.all(promises);
    },
  };

  const provider: EmbeddingProvider = {
    id: 'ollama',
    model,
    embedQuery: client.embed.bind(client),
    embedBatch: client.embedBatch.bind(client),
  };

  return { provider, client };
}

/**
 * List available Ollama models
 */
export async function listOllamaModels(baseURL?: string): Promise<string[]> {
  const url = (baseURL || 'http://localhost:11434') + '/api/tags';

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json() as {
      models: Array<{ name: string }>;
    };

    return data.models?.map((m) => m.name) || [];
  } catch {
    return [];
  }
}
