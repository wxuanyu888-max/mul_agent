/**
 * Error Recovery - 错误自动恢复系统
 *
 * 实现：
 * - 错误分类
 * - 自动恢复策略
 * - 回退机制
 * - 错误学习
 */

import { getGlobalLearningSystem, type LearningSystem } from './learning.js';

/**
 * 错误类型
 */
export type ErrorType =
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'authentication'
  | 'permission'
  | 'validation'
  | 'compilation'
  | 'execution'
  | 'unknown';

/**
 * 错误严重级别
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误信息
 */
export interface RecoveryError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError: unknown;
  timestamp: number;
  context?: Record<string, unknown>;
}

/**
 * 恢复策略
 */
export interface RecoveryStrategy {
  name: string;
  priority: number;
  canHandle: (error: RecoveryError) => boolean;
  recover: (error: RecoveryError, context: RecoveryContext) => Promise<RecoveryResult>;
}

/**
 * 恢复上下文
 */
export interface RecoveryContext {
  attempt: number;
  maxAttempts: number;
  history: RecoveryError[];
  originalInput?: unknown;
}

/**
 * 恢复结果
 */
export interface RecoveryResult {
  success: boolean;
  recovered: boolean;
  message: string;
  newStrategy?: string;
  fallbackResult?: unknown;
}

/**
 * 错误分类器
 */
export class ErrorClassifier {
  /**
   * 分类错误类型
   */
  static classify(error: unknown): RecoveryError {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // 网络错误
    if (
      /ECONNREFUSED|ENOTFOUND|ENETUNREACH|ECONNRESET|ETIMEDOUT/i.test(message) ||
      /fetch failed|network error/i.test(message)
    ) {
      return {
        type: 'network',
        severity: this.determineSeverity(message),
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    // 超时错误
    if (/timeout|timed out/i.test(message)) {
      return {
        type: 'timeout',
        severity: 'medium',
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    // 速率限制
    if (/rate limit|429|too many requests/i.test(message)) {
      return {
        type: 'rate_limit',
        severity: 'medium',
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    // 认证错误
    if (/401|unauthorized|authentication|auth failed|invalid.*api.*key/i.test(message)) {
      return {
        type: 'authentication',
        severity: 'high',
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    // 权限错误
    if (/403|forbidden|permission denied|access denied/i.test(message)) {
      return {
        type: 'permission',
        severity: 'high',
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    // 验证错误
    if (/validation|invalid.*input|malformed|parse error/i.test(message)) {
      return {
        type: 'validation',
        severity: 'low',
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    // 编译错误
    if (/syntax error|compilation|parse error|unexpected token/i.test(message)) {
      return {
        type: 'compilation',
        severity: 'high',
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    // 执行错误
    if (/execution|runtime|process.*failed|command.*failed/i.test(message)) {
      return {
        type: 'execution',
        severity: 'medium',
        message,
        originalError: error,
        timestamp: Date.now(),
      };
    }

    return {
      type: 'unknown',
      severity: 'medium',
      message,
      originalError: error,
      timestamp: Date.now(),
    };
  }

  /**
   * 确定严重级别
   */
  private static determineSeverity(message: string): ErrorSeverity {
    if (/critical|fatal/i.test(message)) return 'critical';
    if (/high|severe/i.test(message)) return 'high';
    if (/medium|moderate/i.test(message)) return 'medium';
    return 'low';
  }
}

/**
 * 错误恢复系统
 */
export class ErrorRecoverySystem {
  private strategies: RecoveryStrategy[] = [];
  private learning?: LearningSystem;
  private errorHistory: RecoveryError[] = [];
  private maxHistory = 100;

  constructor(enableLearning = true) {
    if (enableLearning) {
      this.learning = getGlobalLearningSystem() ?? undefined;
    }

    // 注册默认策略
    this.registerDefaultStrategies();
  }

  /**
   * 注册默认恢复策略
   */
  private registerDefaultStrategies(): void {
    // 网络错误 - 重试
    this.registerStrategy({
      name: 'network_retry',
      priority: 10,
      canHandle: (error) => error.type === 'network',
      recover: async (error, context) => {
        const delay = Math.min(1000 * Math.pow(2, context.attempt), 30000);
        await this.sleep(delay);
        return {
          success: true,
          recovered: true,
          message: `重试成功 (延迟 ${delay}ms)`,
        };
      },
    });

    // 超时 - 延长超时重试
    this.registerStrategy({
      name: 'timeout_retry',
      priority: 10,
      canHandle: (error) => error.type === 'timeout',
      recover: async (error, context) => {
        return {
          success: true,
          recovered: true,
          message: '延长超时后重试',
          newStrategy: 'extended_timeout',
        };
      },
    });

    // 速率限制 - 等待后重试
    this.registerStrategy({
      name: 'rate_limit_backoff',
      priority: 20,
      canHandle: (error) => error.type === 'rate_limit',
      recover: async (error, context) => {
        // 提取 retry-after 时间
        const match = error.message.match(/retry.?after.?(\d+)/i);
        const waitTime = match ? parseInt(match[1]) * 1000 : 60000;
        await this.sleep(waitTime);
        return {
          success: true,
          recovered: true,
          message: `等待 ${waitTime}ms 后重试`,
        };
      },
    });

    // 认证错误 - 切换凭据
    this.registerStrategy({
      name: 'auth_fallback',
      priority: 30,
      canHandle: (error) => error.type === 'authentication',
      recover: async (error, context) => {
        return {
          success: true,
          recovered: true,
          message: '切换认证凭据',
          newStrategy: 'switch_credentials',
        };
      },
    });

    // 权限错误 - 请求权限
    this.registerStrategy({
      name: 'permission_request',
      priority: 30,
      canHandle: (error) => error.type === 'permission',
      recover: async (error, context) => {
        return {
          success: false,
          recovered: false,
          message: '需要权限提升',
          fallbackResult: { requiresPermission: true },
        };
      },
    });

    // 验证错误 - 修复输入
    this.registerStrategy({
      name: 'validation_fix',
      priority: 40,
      canHandle: (error) => error.type === 'validation',
      recover: async (error, context) => {
        return {
          success: true,
          recovered: true,
          message: '尝试修复输入',
          newStrategy: 'fix_input',
        };
      },
    });

    // 编译错误 - 回退代码
    this.registerStrategy({
      name: 'compilation_fallback',
      priority: 50,
      canHandle: (error) => error.type === 'compilation',
      recover: async (error, context) => {
        return {
          success: true,
          recovered: true,
          message: '使用更简单的实现',
          newStrategy: 'simplified_implementation',
        };
      },
    });

    // 执行错误 - 简化方案
    this.registerStrategy({
      name: 'execution_fallback',
      priority: 50,
      canHandle: (error) => error.type === 'execution',
      recover: async (error, context) => {
        return {
          success: true,
          recovered: true,
          message: '使用备选执行方案',
          newStrategy: 'alternative_execution',
        };
      },
    });

    // 未知错误 - 记录并重试
    this.registerStrategy({
      name: 'unknown_retry',
      priority: 5,
      canHandle: () => true,
      recover: async (error, context) => {
        if (context.attempt >= context.maxAttempts) {
          return {
            success: false,
            recovered: false,
            message: `已达到最大重试次数 (${context.maxAttempts})`,
          };
        }

        // 记录到学习系统
        if (this.learning) {
          await this.learning.recordFailure(error.message, {
            type: error.type,
            severity: error.severity,
            attempt: context.attempt,
          });
        }

        return {
          success: true,
          recovered: true,
          message: `重试 (尝试 ${context.attempt + 1}/${context.maxAttempts})`,
        };
      },
    });
  }

  /**
   * 注册恢复策略
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
    // 按优先级排序
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 尝试恢复
   */
  async recover(
    error: unknown,
    options: {
      maxAttempts?: number;
      originalInput?: unknown;
    } = {}
  ): Promise<RecoveryResult> {
    const classifiedError = ErrorClassifier.classify(error);
    const maxAttempts = options.maxAttempts ?? 3;

    // 记录错误
    this.errorHistory.push(classifiedError);
    if (this.errorHistory.length > this.maxHistory) {
      this.errorHistory.shift();
    }

    const context: RecoveryContext = {
      attempt: 0,
      maxAttempts,
      history: [...this.errorHistory],
      originalInput: options.originalInput,
    };

    // 查找合适的策略
    for (const strategy of this.strategies) {
      if (strategy.canHandle(classifiedError)) {
        console.log(`[Recovery] Using strategy: ${strategy.name}`);

        try {
          const result = await strategy.recover(classifiedError, context);

          // 记录成功
          if (result.success && this.learning) {
            await this.learning.recordSuccess(
              `通过 ${strategy.name} 恢复`,
              { errorType: classifiedError.type }
            );
          }

          return result;
        } catch (e) {
          console.error(`[Recovery] Strategy ${strategy.name} failed:`, e);

          // 策略失败，尝试下一个
          context.attempt++;
        }
      }
    }

    return {
      success: false,
      recovered: false,
      message: '所有恢复策略均失败',
    };
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取错误历史
   */
  getErrorHistory(): RecoveryError[] {
    return [...this.errorHistory];
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const error of this.errorHistory) {
      stats[error.type] = (stats[error.type] || 0) + 1;
    }

    return stats;
  }
}

/**
 * 创建错误恢复系统
 */
export function createErrorRecoverySystem(enableLearning?: boolean): ErrorRecoverySystem {
  return new ErrorRecoverySystem(enableLearning);
}

/**
 * 全局错误恢复系统
 */
let globalRecoverySystem: ErrorRecoverySystem | null = null;

export function setGlobalRecoverySystem(system: ErrorRecoverySystem): void {
  globalRecoverySystem = system;
}

export function getGlobalRecoverySystem(): ErrorRecoverySystem | null {
  return globalRecoverySystem;
}

/**
 * 便捷函数：包装需要错误恢复的函数
 */
export async function withRecovery<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    enableRecovery?: boolean;
  } = {}
): Promise<T> {
  const enableRecovery = options.enableRecovery ?? true;

  if (!enableRecovery) {
    return fn();
  }

  const recovery = globalRecoverySystem || createErrorRecoverySystem();

  try {
    return await fn();
  } catch (error) {
    const result = await recovery.recover(error, {
      maxAttempts: options.maxAttempts,
    });

    if (result.recovered) {
      // 重新尝试
      return fn();
    }

    throw error;
  }
}
