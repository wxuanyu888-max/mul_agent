// 测试日志写入
import { logLLMCall, logFromResponse } from './src/agents/llm-logger.js';

console.log('Testing llm-logger...');

logLLMCall({
  id: 'test_' + Date.now(),
  model: 'MiniMax-M2.5',
  duration_ms: 1000,
  input_tokens: 100,
  output_tokens: 50,
  prompt: 'Hello',
  response: 'Hi there',
  stop_reason: 'stop',
  status: 'success',
});

console.log('Log written. Check storage/llm_use/');
