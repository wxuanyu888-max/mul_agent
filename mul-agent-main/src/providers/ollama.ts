/**
 * Ollama LLM Provider (Local)
 */

import { BaseProvider } from '../base.js';
import type { LLMRequest, LLMResponse, LLMProviderConfig } from '../types.js';

export class OllamaProvider extends BaseProvider {
  id = 'ollama';
  name = 'Ollama (Local)';

  private baseUrl: string;
  private model: string;

  constructor(config: LLMProviderConfig) {
    super();
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = config.model || 'llama2';
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.baseUrl}/api/chat`;

    const body = {
      model: request.model || this.model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.max_tokens ?? 4096,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        message: { content: string };
        done: boolean;
        total_duration?: number;
      };

      return {
        content: data.message?.content || '',
        model: this.model,
        usage: {
          input_tokens: 0, // Ollama doesn't provide token counts
          output_tokens: 0,
          total_tokens: 0,
        },
      };
    } catch (error) {
      throw new Error(`Ollama request failed: ${error}`);
    }
  }

  async chatStream(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const url = `${this.baseUrl}/api/chat`;

    const body = {
      model: request.model || this.model,
      messages: request.messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.max_tokens ?? 4096,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const delta = parsed.message?.content;
          if (delta) {
            content += delta;
            onChunk(delta);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return {
      content,
      model: this.model,
    };
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const url = `${this.baseUrl}/api/tags`;

    try {
      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json() as {
        models: Array<{ name: string }>;
      };

      return data.models?.map(m => m.name) || [];
    } catch {
      return [];
    }
  }
}
