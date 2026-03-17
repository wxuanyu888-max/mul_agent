/**
 * Agent 测试脚本 - 使用 llm.ts 客户端
 */

import { chat } from './src/agents/llm.js';

async function main() {
  console.log('🤖 Agent Test (using llm.ts)\n');
  console.log('─'.repeat(50));

  const systemPrompt = '你是一个友好的AI助手。';

  console.log('\n📤 Sending message to LLM...');

  try {
    const response = await chat('你好！', systemPrompt);

    console.log('\n✅ Response received:');
    console.log(response);
  } catch (error) {
    console.error('\n❌ Error:', error);
  }

  console.log('\n' + '─'.repeat(50));
  console.log('✅ Done\n');
}

main();
