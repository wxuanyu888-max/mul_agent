/**
 * s06 Context Compact 测试脚本
 *
 * 测试三层压缩策略：
 * 1. micro_compact: 每次 LLM 调用前，将旧的 tool result 替换为占位符
 * 2. auto_compact: token 超过阈值时，保存完整对话到磁盘，让 LLM 做摘要
 * 3. manual compact: 手动调用 compact 工具触发同样的摘要机制
 */

import { AgentLoop } from './src/agents/loop.js';
import { estimateMessageTokens, needsAutoCompact } from './src/agents/compaction.js';

async function testMicroCompact() {
  console.log('\n=== Test 1: Micro Compact ===\n');

  // 创建模拟的长消息列表，包含多个 tool result
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'Read file A' },
    { role: 'assistant', content: JSON.stringify({ tool_calls: [{ id: '1', name: 'read', input: { path: 'A' } }] }) },
    { role: 'user', content: 'File A content is very long...'.repeat(100), tool_call_id: '1' },
    { role: 'user', content: 'Read file B' },
    { role: 'assistant', content: JSON.stringify({ tool_calls: [{ id: '2', name: 'read', input: { path: 'B' } }] }) },
    { role: 'user', content: 'File B content is very long...'.repeat(100), tool_call_id: '2' },
    { role: 'user', content: 'Read file C' },
    { role: 'assistant', content: JSON.stringify({ tool_calls: [{ id: '3', name: 'read', input: { path: 'C' } }] }) },
    { role: 'user', content: 'File C content is very long...'.repeat(100), tool_call_id: '3' },
    { role: 'user', content: 'Read file D' },
    { role: 'assistant', content: JSON.stringify({ tool_calls: [{ id: '4', name: 'read', input: { path: 'D' } }] }) },
    { role: 'user', content: 'File D content is very long...'.repeat(100), tool_call_id: '4' },
    { role: 'user', content: 'Read file E' },
  ];

  const tokens = estimateMessageTokens(messages);
  console.log(`原始消息数: ${messages.length}`);
  console.log(`原始 token 数: ${tokens}`);

  // 测试 needsAutoCompact
  const needsCompact = needsAutoCompact(messages, 50000);
  console.log(`需要自动压缩 (>50000): ${needsCompact}`);

  console.log('\n原始消息内容预览:');
  for (let i = 0; i < Math.min(5, messages.length); i++) {
    const msg = messages[i];
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    console.log(`[${i}] ${msg.role}: ${content.substring(0, 80)}...`);
  }
}

async function testAgentLoopWithCompaction() {
  console.log('\n=== Test 2: Agent Loop with Compaction ===\n');

  const loop = new AgentLoop({
    maxIterations: 3,
    compaction: {
      autoCompactThreshold: 50000,
      keepRecentResults: 2,
      minResultLengthForCompact: 50,
      transcriptDir: '.transcripts',
    },
  });

  // 注册工具
  loop.registerDefaultTools();

  console.log('开始测试...');
  console.log('发送消息: "List the files in the current directory, then read package.json"');

  try {
    const result = await loop.run({
      message: 'List the files in the current directory, then read package.json',
    });

    console.log('\n--- 结果 ---');
    console.log(`成功: ${result.success}`);
    console.log(`迭代次数: ${result.iterations}`);
    console.log(`工具调用次数: ${result.toolCalls}`);
    console.log(`输入 token: ${result.usage?.inputTokens}`);
    console.log(`输出 token: ${result.usage?.outputTokens}`);
    console.log(`\n内容:\n${result.content.substring(0, 500)}...`);

    if (result.error) {
      console.log(`\n错误: ${result.error}`);
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testAutoCompact() {
  console.log('\n=== Test 3: Auto Compact Trigger ===\n');

  // 创建一个会触发 auto_compact 的场景
  const loop = new AgentLoop({
    maxIterations: 10,
    compaction: {
      autoCompactThreshold: 1000, // 设置一个较低的阈值来触发压缩
      keepRecentResults: 2,
      transcriptDir: '.transcripts',
    },
  });

  loop.registerDefaultTools();

  console.log('配置: autoCompactThreshold=1000, keepRecentResults=2');
  console.log('发送多条消息来触发自动压缩...\n');

  // 发送多条消息
  const prompts = [
    'Read the package.json file',
    'Read the tsconfig.json file',
    'List all files in src/ directory',
    'What is in the src/agents folder?',
    'Tell me about the project structure',
  ];

  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n--- 消息 ${i + 1}: "${prompts[i]}" ---`);

    try {
      const result = await loop.run({
        message: prompts[i],
      });

      console.log(`成功: ${result.success}, 迭代: ${result.iterations}, 工具调用: ${result.toolCalls}`);
      console.log(`Token: 输入=${result.usage?.inputTokens}, 输出=${result.usage?.outputTokens}`);

      if (result.content) {
        console.log(`回复: ${result.content.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error('错误:', error);
      break;
    }
  }
}

async function main() {
  console.log('========================================');
  console.log('s06 Context Compact 测试');
  console.log('========================================');

  await testMicroCompact();
  await testAgentLoopWithCompaction();
  await testAutoCompact();

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

main().catch(console.error);
