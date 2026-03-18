/**
 * Anthropic LLM Provider
 */

import { BaseProvider } from './base.js';
import type { LLMRequest, LLMResponse, LLMProviderConfig } from './types.js';

export class AnthropicProvider extends BaseProvider {
  id = 'anthropic';
  name = 'Anthropic Claude';

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: LLMProviderConfig) {
    super();
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.baseUrl}/messages`;

    // Convert messages to Anthropic format
    const systemMessage = request.messages.find(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const body = {
      model: request.model || this.model,
      messages: otherMessages,
      system: systemMessage?.content,
      max_tokens: request.max_tokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      const content = data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');

      return {
        content,
        model: this.model,
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (error) {
      throw new Error(`Anthropic request failed: ${error}`);
    }
  }
}
