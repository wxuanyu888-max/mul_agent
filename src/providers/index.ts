/**
 * LLM Provider Factory
 *
 * Creates and manages LLM providers
 */

import type { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse, ProviderType } from './types.js';

import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

// Provider registry
const providers: Map<string, LLMProvider> = new Map();
let defaultProvider: LLMProvider | null = null;

// Pre-register default providers
try {
  const openaiProvider = new OpenAIProvider({ provider: 'openai' });
  providers.set(openaiProvider.id, openaiProvider);

  const anthropicProvider = new AnthropicProvider({ provider: 'anthropic' });
  providers.set(anthropicProvider.id, anthropicProvider);

  const ollamaProvider = new OllamaProvider({ provider: 'ollama' });
  providers.set(ollamaProvider.id, ollamaProvider);
} catch {
  // Ignore registration errors during module load
}

/**
 * Create a provider by type
 */
export function createProvider(config: LLMProviderConfig): LLMProvider {
  const { provider } = config;

  switch (provider.toLowerCase()) {
    case 'openai': {
      const p = new OpenAIProvider(config);
      registerProvider(p.id, p);
      return p;
    }

    case 'anthropic':
    case 'claude': {
      const p = new AnthropicProvider(config);
      registerProvider(p.id, p);
      return p;
    }

    case 'ollama': {
      const p = new OllamaProvider(config);
      registerProvider(p.id, p);
      return p;
    }

    case 'azure': {
      // Azure uses OpenAI-compatible API
      const p = new OpenAIProvider({ ...config, baseUrl: `${config.baseUrl}/openai/deployments/${config.model}` });
      registerProvider(p.id, p);
      return p;
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Register a provider
 */
export function registerProvider(id: string, provider: LLMProvider): void {
  providers.set(id, provider);
}

/**
 * Get a registered provider
 */
export function getProvider(id?: string): LLMProvider | null {
  if (id) {
    return providers.get(id) || null;
  }
  return defaultProvider;
}

/**
 * Set default provider
 */
export function setDefaultProvider(provider: LLMProvider): void {
  defaultProvider = provider;
  registerProvider('default', provider);
}

/**
 * Create and set default provider from config
 */
export function createDefaultProvider(config: LLMProviderConfig): LLMProvider {
  const provider = createProvider(config);
  setDefaultProvider(provider);
  return provider;
}

/**
 * Chat with default provider
 */
export async function chat(request: LLMRequest): Promise<LLMResponse> {
  if (!defaultProvider) {
    throw new Error('No default provider configured');
  }
  return defaultProvider.chat(request);
}

/**
 * Chat with specific provider
 */
export async function chatWithProvider(providerId: string, request: LLMRequest): Promise<LLMResponse> {
  const provider = providers.get(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }
  return provider.chat(request);
}

/**
 * List all registered providers
 */
export function listProviders(): string[] {
  return Array.from(providers.keys());
}

// Re-export types
export type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMProviderConfig,
  ProviderType,
} from './types.js';

// Re-export discovery
export {
  ProviderDiscoveryManager,
  defaultDiscoveryManager,
  autoDiscoverProviders,
  type DiscoveryResult,
  type ProviderDiscoveryOptions,
} from './discovery.js';
