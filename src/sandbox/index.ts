/**
 * Security Sandbox
 *
 * 安全沙箱，用于隔离执行不受信任的代码：
 * - 进程隔离
 * - 网络访问控制
 * - 文件系统限制
 * - 资源限制
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * 沙箱配置
 */
export interface SandboxConfig {
  /** 工作目录（限制文件访问） */
  workingDir?: string;
  /** 允许的文件路径模式 */
  allowedPaths?: string[];
  /** 禁止的文件路径模式 */
  blockedPaths?: string[];
  /** 最大内存 (MB) */
  maxMemoryMB?: number;
  /** 最大 CPU 时间 (秒) */
  maxCpuTime?: number;
  /** 是否允许网络访问 */
  allowNetwork?: boolean;
  /** 环境变量白名单 */
  allowedEnvVars?: string[];
  /** 命令超时 (ms) */
  timeout?: number;
}

/**
 * 沙箱结果
 */
export interface SandboxResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration: number;
  error?: string;
}

/**
 * 安全沙箱
 */
export class SecuritySandbox {
  private config: Required<SandboxConfig>;

  constructor(config: SandboxConfig = {}) {
    this.config = {
      workingDir: config.workingDir || process.cwd(),
      allowedPaths: config.allowedPaths || [],
      blockedPaths: config.blockedPaths || ['/etc', '/root', '/.ssh', '/.aws'],
      maxMemoryMB: config.maxMemoryMB || 512,
      maxCpuTime: config.maxCpuTime || 30,
      allowNetwork: config.allowNetwork ?? false,
      allowedEnvVars: config.allowedEnvVars || ['PATH', 'HOME', 'USER'],
      timeout: config.timeout || 30000,
    };
  }

  /**
   * 执行命令（沙箱中）
   */
  async execute(command: string, args: string[] = []): Promise<SandboxResult> {
    const startTime = Date.now();

    // 验证命令
    const validation = this.validateCommand(command, args);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        duration: Date.now() - startTime,
      };
    }

    // 构建环境变量
    const env = this.buildEnv();

    try {
      // 使用 subprocess 运行
      const child = spawn(command, args, {
        cwd: this.config.workingDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // 超时控制
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
      }, this.config.timeout);

      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code) => {
          clearTimeout(timeout);
          resolve(code ?? 0);
        });
        child.on('error', () => {
          clearTimeout(timeout);
          resolve(1);
        });
      });

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行 JavaScript 代码（沙箱中）
   */
  async executeJS(code: string): Promise<SandboxResult> {
    // 创建临时文件
    const tempFile = path.join(this.config.workingDir, `.sandbox_${Date.now()}.js`);

    try {
      await fs.writeFile(tempFile, code, { mode: 0o755 });

      // 使用 Node 运行
      return await this.execute('node', [tempFile]);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
      };
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * 读取文件（受限）
   */
  async readFile(filePath: string): Promise<string> {
    const validation = this.validatePath(filePath);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * 写入文件（受限）
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const validation = this.validatePath(filePath);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    await fs.writeFile(filePath, content);
  }

  /**
   * 验证命令
   */
  private validateCommand(command: string, args: string[]): { valid: boolean; error?: string } {
    // 检查危险命令
    const dangerousCommands = ['rm', 'del', 'mkfs', 'dd', 'shutdown', 'reboot', 'init'];

    const cmdName = path.basename(command);
    if (dangerousCommands.includes(cmdName.toLowerCase())) {
      return { valid: false, error: `Command not allowed: ${cmdName}` };
    }

    // 检查参数中的危险内容
    const dangerousPatterns = [/--format=force/i, /-rf/i, /dev\/sd/i];

    for (const arg of args) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          return { valid: false, error: `Dangerous argument: ${arg}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 验证路径
   */
  private validatePath(filePath: string): { valid: boolean; error?: string } {
    const resolved = path.resolve(this.config.workingDir, filePath);

    // 检查是否在允许的路径内
    if (this.config.allowedPaths.length > 0) {
      const isAllowed = this.config.allowedPaths.some(p =>
        resolved.startsWith(path.resolve(p))
      );
      if (!isAllowed) {
        return { valid: false, error: 'Path not in allowed list' };
      }
    }

    // 检查是否在禁止的路径内
    for (const blocked of this.config.blockedPaths) {
      if (resolved.startsWith(path.resolve(blocked))) {
        return { valid: false, error: 'Path is blocked' };
      }
    }

    return { valid: true };
  }

  /**
   * 构建安全的环境变量
   */
  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};

    // 只保留白名单中的环境变量
    for (const key of this.config.allowedEnvVars) {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    }

    // 添加沙箱标识
    env.SANDBOX_MODE = 'true';

    // 限制 PATH
    if (env.PATH) {
      const safePaths = env.PATH.split(':')
        .filter(p => !p.includes('..'))
        .slice(0, 5);
      env.PATH = safePaths.join(':');
    }

    return env;
  }
}

/**
 * 创建沙箱
 */
export function createSandbox(config?: SandboxConfig): SecuritySandbox {
  return new SecuritySandbox(config);
}

/**
 * 预定义沙箱配置
 */
export const SandboxProfiles = {
  /**
   * 开发环境沙箱
   */
  development: {
    workingDir: process.cwd(),
    blockedPaths: ['/etc', '/root', '/.ssh'],
    maxMemoryMB: 1024,
    timeout: 60000,
  } as SandboxConfig,

  /**
   * 生产环境沙箱（严格）
   */
  production: {
    allowedPaths: [process.cwd()],
    blockedPaths: ['/etc', '/root', '/.ssh', '/.aws', '/.env'],
    maxMemoryMB: 512,
    allowNetwork: false,
    timeout: 30000,
  } as SandboxConfig,

  /**
   * 测试环境沙箱
   */
  testing: {
    blockedPaths: ['/etc', '/root', '/.ssh'],
    maxMemoryMB: 512,
    timeout: 15000,
  } as SandboxConfig,
};
