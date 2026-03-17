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

/**
 * Create a provider by type
 */
export function createProvider(config: LLMProviderConfig): LLMProvider {
  const { provider } = config;

  switch (provider.toLowerCase()) {
    case 'openai':
      return new OpenAIProvider(config);

    case 'anthropic':
    case 'claude':
      return new AnthropicProvider(config);

    case 'ollama':
      return new OllamaProvider(config);

    case 'azure':
      // Azure uses OpenAI-compatible API
      return new OpenAIProvider({ ...config, baseUrl: `${config.baseUrl}/openai/deployments/${config.model}` });

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
