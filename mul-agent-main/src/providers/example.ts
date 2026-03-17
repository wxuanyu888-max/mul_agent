/**
 * LLM Provider 使用示例
 */

import { createDefaultProvider, chat, type LLMRequest } from './index.js';

// 方式1: 创建默认 Provider
async function example1() {
  // OpenAI
  const openai = createDefaultProvider({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Anthropic
  const anthropic = createDefaultProvider({
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Ollama (本地)
  const ollama = createDefaultProvider({
    provider: 'ollama',
    model: 'llama2',
    baseUrl: 'http://localhost:11434',
  });
}

// 方式2: 直接调用 chat
async function example2() {
  const request: LLMRequest = {
    messages: [
      { role: 'system', content: '你是一个有帮助的助手' },
      { role: 'user', content: '你好，请介绍一下自己' },
    ],
    model: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 1000,
  };

  const response = await chat(request);

  console.log('Response:', response.content);
  console.log('Usage:', response.usage);
}

// 方式3: 切换不同 Provider
async function example3() {
  const { createProvider, chat } = await import('./index.js');

  // 使用 OpenAI
  const openai = createProvider({ provider: 'openai', model: 'gpt-4o' });
  const openaiRes = await openai.chat({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  console.log('OpenAI:', openaiRes.content);

  // 使用 Anthropic
  const anthropic = createProvider({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
  const anthropicRes = await anthropic.chat({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  console.log('Anthropic:', anthropicRes.content);

  // 使用 Ollama
  const ollama = createProvider({ provider: 'ollama', model: 'llama2' });
  const ollamaRes = await ollama.chat({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  console.log('Ollama:', ollamaRes.content);
}

// 方式4: 流式输出
async function example4() {
  const { createProvider } = await import('./index.js');

  const openai = createProvider({ provider: 'openai' });

  if (openai.chatStream) {
    await openai.chatStream(
      { messages: [{ role: 'user', content: '写一个故事' }] },
      (chunk) => {
        process.stdout.write(chunk); // 实时输出
      }
    );
  }
}

// 运行示例
// example2();
