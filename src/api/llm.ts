// Simple LLM Chat Implementation
// 这是一个简单的 LLM 调用实现，可以后续替换为真正的 LLM API

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 简单的 LLM 调用函数
 * 支持 Anthropic 和 OpenAI API
 */
export async function llmChat(
  message: string,
  history: LLMMessage[] = [],
  options: LLMOptions = {}
): Promise<string> {
  const { model = 'claude-sonnet-4-20250514', temperature = 0.7 } = options;

  // 检查是否有 API key
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // 没有 API key，返回模拟响应
    return getMockResponse(message, history);
  }

  // 如果有 API key，调用真正的 LLM
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      return await callAnthropic(message, history, model, temperature);
    } else if (process.env.OPENAI_API_KEY) {
      return await callOpenAI(message, history, model, temperature);
    }
  } catch (error) {
    console.error('LLM API call failed:', error);
    return getMockResponse(message, history);
  }

  return getMockResponse(message, history);
}

/**
 * 调用 Anthropic API
 */
async function callAnthropic(
  message: string,
  history: LLMMessage[],
  model: string,
  temperature: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message }
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * 调用 OpenAI API
 */
async function callOpenAI(
  message: string,
  history: LLMMessage[],
  model: string,
  temperature: number
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 模拟响应（当没有 API key 时使用）
 */
function getMockResponse(message: string, history: LLMMessage[]): string {
  const lowerMessage = message.toLowerCase();

  // 简单的关键词匹配响应
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return 'Hello! How can I help you today?';
  }

  if (lowerMessage.includes('help')) {
    return 'I can help you with various tasks. Just tell me what you need!';
  }

  if (lowerMessage.includes('name')) {
    return 'I am your AI assistant. You can call me Assistant.';
  }

  // 默认响应
  return `I received your message: "${message}". This is a mock response because no LLM API key is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable to use a real LLM.`;
}
