/**
 * Base LLM Provider
 */

import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';

export abstract class BaseProvider implements LLMProvider {
  abstract id: string;
  abstract name: string;

  abstract chat(request: LLMRequest): Promise<LLMResponse>;

  async chatStream?(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Default: fall back to non-streaming
    const response = await this.chat(request);
    onChunk(response.content);
    return response;
  }

  protected abstract getHeaders(): Record<string, string>;

  protected buildUrl(path: string): string {
    return path;
  }
}

export default BaseProvider;
