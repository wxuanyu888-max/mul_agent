/**
 * LLM Provider Types
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export interface LLMProvider {
  id: string;
  name: string;
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream?(request: LLMRequest, onChunk: (chunk: string) => void): Promise<LLMResponse>;
}

export interface LLMProviderConfig {
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  // Provider-specific options
  maxTokens?: number;
  temperature?: number;
}

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'azure' | 'custom';
