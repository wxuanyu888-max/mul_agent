/**
 * Provider Discovery System
 *
 * Automatically discovers and configures LLM providers
 * Based on OpenClaw's provider discovery system
 */

import type { LLMProviderConfig, ProviderType } from './types.js';

export interface DiscoveryResult {
  provider: LLMProviderConfig;
  source: 'explicit' | 'discovery' | 'default';
}

export interface ProviderDiscoveryOptions {
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
}

/**
 * Provider Discovery Interface
 */
export interface IProviderDiscovery {
  id: string;
  order: 'early' | 'normal' | 'late';
  discover(options: ProviderDiscoveryOptions): Promise<DiscoveryResult | null>;
}

/**
 * OpenAI Provider Discovery
 */
export class OpenAIDiscovery implements IProviderDiscovery {
  id = 'openai';
  order: 'early' | 'normal' | 'late' = 'normal';

  async discover(options: ProviderDiscoveryOptions): Promise<DiscoveryResult | null> {
    // Check if explicitly configured
    if (options.apiKey || options.baseUrl) {
      return {
        provider: {
          provider: 'openai',
          model: options.models?.[0] || 'gpt-4o',
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
        },
        source: 'explicit',
      };
    }

    // Check environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      return {
        provider: {
          provider: 'openai',
          model: 'gpt-4o',
          apiKey,
        },
        source: 'discovery',
      };
    }

    return null;
  }
}

/**
 * Anthropic Provider Discovery
 */
export class AnthropicDiscovery implements IProviderDiscovery {
  id = 'anthropic';
  order: 'early' | 'normal' | 'late' = 'normal';

  async discover(options: ProviderDiscoveryOptions): Promise<DiscoveryResult | null> {
    // Check if explicitly configured
    if (options.apiKey || options.baseUrl) {
      return {
        provider: {
          provider: 'anthropic',
          model: options.models?.[0] || 'claude-sonnet-4-20250514',
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
        },
        source: 'explicit',
      };
    }

    // Check environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      return {
        provider: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          apiKey,
        },
        source: 'discovery',
      };
    }

    return null;
  }
}

/**
 * Ollama Provider Discovery
 */
export class OllamaDiscovery implements IProviderDiscovery {
  id = 'ollama';
  order: 'early' | 'normal' | 'late' = 'late';

  async discover(options: ProviderDiscoveryOptions): Promise<DiscoveryResult | null> {
    // Check if explicitly configured
    if (options.baseUrl) {
      return {
        provider: {
          provider: 'ollama',
          model: options.models?.[0] || 'llama3',
          baseUrl: options.baseUrl,
        },
        source: 'explicit',
      };
    }

    // Try to connect to local Ollama
    const baseUrl = 'http://localhost:11434';

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        const defaultModel = models[0]?.name || 'llama3';

        return {
          provider: {
            provider: 'ollama',
            model: defaultModel,
            baseUrl,
            apiKey: 'ollama-local',
          },
          source: 'discovery',
        };
      }
    } catch {
      // Ollama not available locally
    }

    return null;
  }
}

/**
 * MiniMax Provider Discovery
 */
export class MiniMaxDiscovery implements IProviderDiscovery {
  id = 'minimax';
  order: 'early' | 'normal' | 'late' = 'late';

  async discover(options: ProviderDiscoveryOptions): Promise<DiscoveryResult | null> {
    // Check if explicitly configured
    if (options.apiKey) {
      return {
        provider: {
          provider: 'minimax',
          model: options.models?.[0] || 'MiniMax-M2.1',
          apiKey: options.apiKey,
          baseUrl: options.baseUrl || 'https://api.minimax.chat/v1',
        },
        source: 'explicit',
      };
    }

    // Check environment
    const apiKey = process.env.MINIMAX_API_KEY;
    if (apiKey) {
      return {
        provider: {
          provider: 'minimax',
          model: 'MiniMax-M2.1',
          apiKey,
          baseUrl: 'https://api.minimax.chat/v1',
        },
        source: 'discovery',
      };
    }

    return null;
  }
}

/**
 * Azure OpenAI Provider Discovery
 */
export class AzureDiscovery implements IProviderDiscovery {
  id = 'azure';
  order: 'early' | 'normal' | 'late' = 'early';

  async discover(options: ProviderDiscoveryOptions): Promise<DiscoveryResult | null> {
    // Azure requires explicit configuration
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;

    if (apiKey && endpoint) {
      return {
        provider: {
          provider: 'azure',
          model: options.models?.[0] || 'gpt-4',
          apiKey,
          baseUrl: endpoint,
        },
        source: 'discovery',
      };
    }

    return null;
  }
}

/**
 * Provider Discovery Manager
 */
export class ProviderDiscoveryManager {
  private discoveries: Map<string, IProviderDiscovery> = new Map();

  constructor() {
    // Register default discoveries
    this.register(new OpenAIDiscovery());
    this.register(new AnthropicDiscovery());
    this.register(new OllamaDiscovery());
    this.register(new MiniMaxDiscovery());
    this.register(new AzureDiscovery());
  }

  /**
   * Register a discovery provider
   */
  register(discovery: IProviderDiscovery): void {
    this.discoveries.set(discovery.id, discovery);
  }

  /**
   * Unregister a discovery provider
   */
  unregister(id: string): void {
    this.discoveries.delete(id);
  }

  /**
   * Get discovery provider
   */
  get(id: string): IProviderDiscovery | undefined {
    return this.discoveries.get(id);
  }

  /**
   * Discover all available providers
   */
  async discoverAll(
    explicitConfigs: Record<string, ProviderDiscoveryOptions>
  ): Promise<Map<string, DiscoveryResult>> {
    const results = new Map<string, DiscoveryResult>();

    // Run discoveries in order
    const sortedDiscoveries = Array.from(this.discoveries.values()).sort((a, b) => {
      const order = { early: 0, normal: 1, late: 2 };
      return order[a.order] - order[b.order];
    });

    for (const discovery of sortedDiscoveries) {
      const explicitConfig = explicitConfigs[discovery.id];

      // Skip if explicitly disabled
      if (explicitConfig && explicitConfig.apiKey === '') {
        continue;
      }

      const result = await discovery.discover(explicitConfig || {});

      if (result) {
        results.set(discovery.id, result);
      }
    }

    return results;
  }

  /**
   * Discover a specific provider
   */
  async discoverProvider(
    id: string,
    explicitConfig?: ProviderDiscoveryOptions
  ): Promise<DiscoveryResult | null> {
    const discovery = this.discoveries.get(id);
    if (!discovery) {
      return null;
    }

    return discovery.discover(explicitConfig || {});
  }

  /**
   * List all registered discovery providers
   */
  listProviders(): string[] {
    return Array.from(this.discoveries.keys());
  }
}

// Default instance
export const defaultDiscoveryManager = new ProviderDiscoveryManager();

/**
 * Auto-discover providers from environment and config
 */
export async function autoDiscoverProviders(
  config?: Record<string, ProviderDiscoveryOptions>
): Promise<Record<string, LLMProviderConfig>> {
  const results = await defaultDiscoveryManager.discoverAll(config || {});
  const providers: Record<string, LLMProviderConfig> = {};

  for (const [id, result] of results) {
    providers[id] = result.provider;
  }

  return providers;
}
