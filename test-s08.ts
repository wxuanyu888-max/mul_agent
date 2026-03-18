/**
 * s08 后台任务测试
 *
 * 测试后台任务功能：
 * 1. 启动后台命令
 * 2. Agent 继续其他工作
 * 3. 后台任务完成后，通知被注入到下一轮 LLM 调用
 */

import { createAgentLoop } from './src/agents/loop.js';

async function main() {
  console.log('🧪 s08 Background Tasks Test\n');
  console.log('='.repeat(60));

  // 创建 Agent 循环
  const loop = createAgentLoop({
    maxIterations: 5,
    timeoutMs: 120000,
    workspaceDir: process.cwd(),
  });

  // 注册默认工具（包括新的后台任务工具）
  loop.registerDefaultTools();

  console.log('\n📝 Test prompt:');
  console.log('Run "sleep 2 && echo done" in background, then check its status');
  console.log('='.repeat(60));

  // 运行 Agent
  const result = await loop.run({
    message: 'Run "sleep 2 && echo done" in the background, then check its status',
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 Result:');
  console.log('-'.repeat(60));
  console.log(`Success: ${result.success}`);
  console.log(`Iterations: ${result.iterations}`);
  console.log(`Tool calls: ${result.toolCalls}`);
  console.log(`Error: ${result.error || 'none'}`);
  console.log('-'.repeat(60));
  console.log('📄 Content:');
  console.log(result.content);
  console.log('='.repeat(60));
}

main().catch(console.error);
