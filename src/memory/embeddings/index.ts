/**
 * Embeddings Module
 *
 * Factory and exports for all embedding providers.
 */

import type {
  EmbeddingProvider,
  EmbeddingProviderResult,
  EmbeddingProviderOptions,
} from '../types.js';

export type { EmbeddingProviderOptions } from '../types.js';

export { createOpenAIEmbeddingProvider, type OpenAIEmbeddingConfig, type OpenAIEmbeddingClient } from './openai.js';
export { createVoyageEmbeddingProvider, type VoyageEmbeddingConfig, type VoyageEmbeddingClient } from './voyage.js';
export { createGeminiEmbeddingProvider, type GeminiEmbeddingConfig, type GeminiEmbeddingClient } from './gemini.js';
export { createMistralEmbeddingProvider, type MistralEmbeddingConfig, type MistralEmbeddingClient } from './mistral.js';
export { createOllamaEmbeddingProvider, listOllamaModels, type OllamaEmbeddingConfig, type OllamaEmbeddingClient } from './ollama.js';
export { sanitizeAndNormalizeEmbedding, getDefaultEmbeddingModel, DEFAULT_EMBEDDING_MODELS } from './base.js';
export { createOfflineEmbeddingProvider, OfflineEmbeddingProvider } from './offline.js';

/**
 * Create an embedding provider based on configuration
 */
export async function createEmbeddingProvider(
  options: EmbeddingProviderOptions
): Promise<EmbeddingProviderResult> {
  const { provider: requestedProvider, fallback = 'none' } = options;

  // Try to create the requested provider
  const result = await tryCreateProvider(options);

  if (result.provider) {
    return result;
  }

  // If fallback is enabled and primary provider failed, try fallback
  if (fallback !== 'none' && result.providerUnavailableReason) {
    const fallbackOptions = { ...options, provider: fallback };
    const fallbackResult = await tryCreateProvider(fallbackOptions);

    if (fallbackResult.provider) {
      return {
        ...fallbackResult,
        fallbackFrom: fallback,
        fallbackReason: result.providerUnavailableReason,
      };
    }
  }

  // Return the original failure result
  return result;
}

async function tryCreateProvider(
  options: EmbeddingProviderOptions
): Promise<EmbeddingProviderResult> {
  const { provider } = options;

  switch (provider) {
    case 'openai':
    case 'auto': {
      try {
        const { provider: p } = await import('./openai.js').then((m) =>
          m.createOpenAIEmbeddingProvider({
            apiKey: options.remote?.apiKey as string | undefined,
            baseURL: options.remote?.baseUrl,
            model: options.model,
          })
        );
        return { provider: p, requestedProvider: provider };
      } catch (err) {
        return {
          provider: null,
          requestedProvider: provider,
          providerUnavailableReason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    case 'voyage': {
      try {
        const { provider: p } = await import('./voyage.js').then((m) =>
          m.createVoyageEmbeddingProvider({
            apiKey: options.remote?.apiKey as string | undefined,
            baseURL: options.remote?.baseUrl,
            model: options.model,
          })
        );
        return { provider: p, requestedProvider: provider };
      } catch (err) {
        return {
          provider: null,
          requestedProvider: provider,
          providerUnavailableReason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    case 'gemini': {
      try {
        const { provider: p } = await import('./gemini.js').then((m) =>
          m.createGeminiEmbeddingProvider({
            apiKey: options.remote?.apiKey as string | undefined,
            model: options.model,
          })
        );
        return { provider: p, requestedProvider: provider };
      } catch (err) {
        return {
          provider: null,
          requestedProvider: provider,
          providerUnavailableReason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    case 'mistral': {
      try {
        const { provider: p } = await import('./mistral.js').then((m) =>
          m.createMistralEmbeddingProvider({
            apiKey: options.remote?.apiKey as string | undefined,
            baseURL: options.remote?.baseUrl,
            model: options.model,
          })
        );
        return { provider: p, requestedProvider: provider };
      } catch (err) {
        return {
          provider: null,
          requestedProvider: provider,
          providerUnavailableReason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    case 'ollama':
    case 'local': {
      try {
        const { provider: p } = await import('./ollama.js').then((m) =>
          m.createOllamaEmbeddingProvider({
            baseURL: options.remote?.baseUrl,
            model: options.local?.modelPath || 'nomic-embed-text',
          })
        );
        return { provider: p, requestedProvider: provider };
      } catch (err) {
        return {
          provider: null,
          requestedProvider: provider,
          providerUnavailableReason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    case 'offline': {
      try {
        const { createOfflineEmbeddingProvider } = await import('./offline.js');
        const provider = createOfflineEmbeddingProvider();
        return { provider, requestedProvider: 'offline' as const };
      } catch (err) {
        return {
          provider: null,
          requestedProvider: 'offline' as const,
          providerUnavailableReason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    default:
      return {
        provider: null,
        requestedProvider: provider,
        providerUnavailableReason: `Unknown provider: ${provider}`,
      };
  }
}
