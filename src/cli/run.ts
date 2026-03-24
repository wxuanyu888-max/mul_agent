/**
 * CLI 入口点 - 用于测试和直接运行
 */
import { createCli, registerCommand } from "./index.js";
import {
  createHelpCommand,
  createVersionCommand,
  createStatusCommand,
  createStartCommand,
  createStopCommand,
  createListCommand,
} from "./commands/index.js";

// 获取命令列表
function getCommands() {
  return [
    createHelpCommand(getCommands),
    createVersionCommand("1.0.0"),
    createStatusCommand(async () => ({
      status: "running",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    })),
    createStartCommand(async (options) => {
      console.log("Starting agent with options:", options);
      // 模拟启动
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Agent started!");
    }),
    createStopCommand(async () => {
      console.log("Stopping agent...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("Agent stopped!");
    }),
    createListCommand(async (type: string) => {
      // 模拟列表数据
      if (type === "sessions") {
        return ["session-1", "session-2", "session-3"];
      } else if (type === "agents") {
        return ["agent-1", "agent-2"];
      } else if (type === "tools") {
        return ["bash", "file", "browser", "search"];
      }
      return [];
    }),
  ];
}

// 创建 CLI 应用
const cli = createCli({
  name: "mul-agent",
  version: "1.0.0",
  description: "Multi-Agent Collaboration System CLI",
  commands: getCommands(),
});

// 从命令行参数运行
const argv = process.argv.slice(2);
if (argv.length === 0) {
  // 无参数时显示帮助
  cli.run(["--help"]);
} else {
  cli.run(argv);
}
