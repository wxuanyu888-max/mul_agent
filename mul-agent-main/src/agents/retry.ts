// 重试机制
// 提供指数退避的重试逻辑，用于 LLM 调用等

/**
 * 重试配置
 */
export interface RetryConfig {
  maxAttempts: number;           // 最大尝试次数
  initialDelayMs: number;        // 初始延迟（毫秒）
  maxDelayMs: number;            // 最大延迟（毫秒）
  backoffMultiplier: number;     // 退避倍数
  retryableErrors?: (string | RegExp)[];  // 可重试的错误类型
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'rate_limit',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算延迟
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * 检查错误是否可重试
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);

  for (const pattern of config.retryableErrors || []) {
    if (typeof pattern === 'string') {
      if (errorMessage.includes(pattern)) {
        return true;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(errorMessage)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 重试选项
 */
export interface RetryOptions<T> {
  config?: Partial<RetryConfig>;
  onAttempt?: (attempt: number, error: unknown) => void;
  onSuccess?: (result: T, attempt: number) => void;
  onFinalError?: (error: unknown, attempts: number) => void;
}

/**
 * 带重试的异步函数执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options.config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (options.onSuccess) {
        options.onSuccess(result, attempt);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (options.onAttempt) {
        options.onAttempt(attempt, error);
      }

      // 最后一次尝试失败，不再重试
      if (attempt >= config.maxAttempts) {
        break;
      }

      // 检查错误是否可重试
      if (!isRetryableError(error, config)) {
        break;
      }

      // 计算延迟
      const delay = calculateDelay(attempt, config);
      console.log(`🔄 Retry attempt ${attempt + 1}/${config.maxAttempts} after ${delay}ms...`);
      await sleep(delay);
    }
  }

  if (options.onFinalError) {
    options.onFinalError(lastError!, config.maxAttempts);
  }

  throw lastError;
}

/**
 * 创建可重试的函数
 */
export function createRetryableFn<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): () => Promise<T> {
  return () => withRetry(fn, { config });
}

/**
 * 重试状态
 */
export interface RetryState {
  attempt: number;
  totalAttempts: number;
  lastError?: unknown;
  startTime: number;
  endTime?: number;
  succeeded: boolean;
}

/**
 * 创建重试状态跟踪器
 */
export function createRetryState(maxAttempts: number): RetryState {
  return {
    attempt: 0,
    totalAttempts: maxAttempts,
    startTime: Date.now(),
    succeeded: false,
  };
}
