// Tmux 持久化会话管理
// 确保每次 exec 调用都在同一个 tmux 会话中执行，保持环境持久化

import { exec as execAsync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execPromise = promisify(execAsync);

// 默认会话名称
const DEFAULT_SESSION = 'mulagent';
let currentSession: string = DEFAULT_SESSION;

// 锁文件，防止并发执行
let isExecuting = false;
const executionLock = async (fn: () => Promise<any>) => {
  while (isExecuting) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  isExecuting = true;
  try {
    return await fn();
  } finally {
    isExecuting = false;
  }
};

/**
 * 在 tmux 会话中执行命令（持久化环境）
 */
export async function tmuxExec(
  command: string,
  options: {
    timeout?: number;
    cwd?: string;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  returnCode: number;
  timedOut?: boolean;
}> {
  return executionLock(async () => {
    const timeout = options.timeout || 60000;
    const cwd = options.cwd || process.cwd();

    // 确保 tmux 会话存在
    await ensureSession();

    // 创建唯一的标记来识别我们的输出
    const marker = `__MULAGENT_OUTPUT_END__`;
    const outputFile = `/tmp/tmux_output_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`;

    // 包装命令：
    // 1. cd 到指定目录
    // 2. 执行命令，输出到临时文件
    // 3. 输出 EXITCODE
    // 4. 输出结束标记
    const wrappedCommand = `cd "${cwd}" && (${command} > ${outputFile} 2>&1); echo "EXITCODE:$?" >> ${outputFile} && echo "${marker}" >> ${outputFile}`;

    // 使用 tmux send-keys 发送命令
    const escapedCommand = wrappedCommand.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    await execPromise(`tmux send-keys -t ${currentSession} "${escapedCommand}" Enter`);

    // 等待命令完成
    let elapsed = 0;
    const pollInterval = 200;

    while (elapsed < timeout) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;

      try {
        // 检查标记是否存在
        const { stdout: checkResult } = await execPromise(`grep -q "${marker}" ${outputFile} 2>/dev/null && echo "done" || echo "waiting"`);

        if (checkResult.trim() === 'done') {
          // 读取完整输出
          await new Promise(resolve => setTimeout(resolve, 100)); // 等待文件写入完成
          const { stdout: fullOutput } = await execPromise(`cat ${outputFile}`);

          // 清理临时文件
          await execPromise(`rm -f ${outputFile}`);

          // 解析输出和退出码
          const lines = fullOutput.split('\n');
          let exitCode = 0;
          let stdout = '';

          for (const line of lines) {
            if (line.startsWith('EXITCODE:')) {
              exitCode = parseInt(line.replace('EXITCODE:', '').trim()) || 0;
            } else if (!line.includes(marker) && line.trim()) {
              stdout += line + '\n';
            }
          }

          return {
            stdout: stdout.trim(),
            stderr: '',
            returnCode: exitCode,
          };
        }
      } catch {
        // 继续等待
      }
    }

    // 超时 - 清理临时文件，忽略错误
    try {
      await execPromise(`rm -f ${outputFile}`);
    } catch {
      // 忽略清理错误
    }

    return {
      stdout: '',
      stderr: 'Command timed out',
      returnCode: -1,
      timedOut: true,
    };
  });
}

/**
 * 确保 tmux 会话存在，不存在则创建
 */
async function ensureSession(): Promise<void> {
  // 检查会话是否存在
  try {
    await execPromise(`tmux has-session -t ${currentSession} 2>/dev/null`);
    // 会话已存在
  } catch {
    // 创建新会话
    await execPromise(`tmux new-session -d -s ${currentSession}`);
  }
}

/**
 * 初始化 tmux 会话
 */
export async function initTmuxSession(sessionName?: string): Promise<void> {
  if (sessionName) {
    currentSession = sessionName;
  }
  await ensureSession();
}

/**
 * 获取当前会话名称
 */
export function getSessionName(): string {
  return currentSession;
}

/**
 * 设置会话名称
 */
export function setSessionName(name: string): void {
  currentSession = name;
}
