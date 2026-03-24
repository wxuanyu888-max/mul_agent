/**
 * 交互式 CLI - 类似 Claude Code 的对话界面
 */
import * as readline from 'node:readline';
import { runAgent } from '../agents/loop.js';
import type { Message } from '../agents/types.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\nmul-agent> ',
});

let history: Message[] = [];

console.log(`
╔══════════════════════════════════════════════════════════╗
║                    Mul-Agent CLI                         ║
║          Multi-Agent Collaboration System                 ║
║                                                          ║
║  Type your message and press Enter to chat.              ║
║  Type 'exit' or 'quit' to exit.                         ║
║  Type 'clear' to clear history.                         ║
║  Type 'help' for more commands.                         ║
╚══════════════════════════════════════════════════════════╝
`);

function promptUser() {
  rl.prompt();
}

rl.on('line', async (line) => {
  const input = line.trim();

  if (!input) {
    promptUser();
    return;
  }

  // 处理命令
  switch (input.toLowerCase()) {
    case 'exit':
    case 'quit':
    case 'q':
      console.log('Goodbye!');
      rl.close();
      return;

    case 'clear':
      history = [];
      console.log('History cleared.');
      promptUser();
      return;

    case 'help':
    case 'h':
    case '?':
      console.log(`
Commands:
  exit, quit, q   - Exit the CLI
  clear           - Clear conversation history
  help, h, ?      - Show this help message

Just type your message to chat with the agent!
      `);
      promptUser();
      return;

    default:
      // 发送到 Agent
      console.log('\n[Thinking...]\n');

      try {
        const result = await runAgent({
          message: input,
          history: history,
          maxIterations: 50,
          workspaceDir: process.cwd(),
        });

        // 显示结果
        console.log('\n────────────────────────────────────────────');
        console.log(result.content || '(No response)');

        if (result.toolCalls > 0) {
          console.log(`\n[Used ${result.toolCalls} tool call(s) in ${result.iterations} iteration(s)]`);
        }

        if (result.error) {
          console.log(`\n[Error: ${result.error}]`);
        }

        console.log('────────────────────────────────────────────\n');

        // 更新历史
        history.push({ role: 'user', content: input });
        history.push({ role: 'assistant', content: result.content });

      } catch (error) {
        console.error('\n[Error]', error instanceof Error ? error.message : String(error));
      }

      promptUser();
  }
});

rl.on('close', () => {
  process.exit(0);
});

promptUser();
