/**
 * 直接测试 logger
 */

import { logLlmCall } from './src/logger/index.js';

async function main() {
  console.log('🧪 Testing Logger...\n');

  // 直接调用 logLlmCall
  await logLlmCall({
    provider: 'minimax',
    model: 'MiniMax-M2.5',
    agentId: 'test',
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    latencyMs: 1000,
    success: true,
    finishReason: 'stop',
  });

  console.log('\n✅ Done');
}

main();
