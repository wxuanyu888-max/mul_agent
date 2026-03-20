/**
 * teammate_ask - 同步请求-响应工具
 *
 * 与 teammate_send 的区别：
 * - send: 异步消息，发送后立即返回
 * - ask: 同步等待响应，会阻塞直到收到回复或超时
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { jsonResult, errorResult } from "../types.js";

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'teammates', 'asks');

/**
 * 确保存储目录存在
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * 请求记录
 */
interface AskRequest {
  id: string;
  from: string;
  to: string;
  question: string;
  status: 'pending' | 'answered' | 'timeout' | 'cancelled';
  answer?: string;
  createdAt: number;
  answeredAt?: number;
  expiresAt: number;
}

/**
 * 保存请求
 */
function saveRequest(r: AskRequest): void {
  ensureStorageDir();
  const filePath = path.join(STORAGE_DIR, `${r.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(r, null, 2), 'utf-8');
}

/**
 * 加载请求
 */
function loadRequest(id: string): AskRequest | null {
  const filePath = path.join(STORAGE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AskRequest;
  } catch {
    return null;
  }
}

/**
 * 等待响应
 */
function waitForAnswer(requestId: string, timeoutMs: number): AskRequest | null {
  const startTime = Date.now();
  const maxPolls = Math.floor(timeoutMs / 500); // 每 500ms 检查一次

  for (let i = 0; i < maxPolls; i++) {
    const request = loadRequest(requestId);
    if (!request) return null;

    if (request.status === 'answered') {
      return request;
    }

    if (request.status === 'timeout' || request.status === 'cancelled') {
      return request;
    }

    // 检查是否过期
    if (Date.now() > request.expiresAt) {
      request.status = 'timeout';
      saveRequest(request);
      return request;
    }

    // 等待后再检查
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    // 同步等待
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) break;
  }

  // 超时
  const request = loadRequest(requestId);
  if (request && request.status === 'pending') {
    request.status = 'timeout';
    saveRequest(request);
  }
  return request;
}

/**
 * 创建 teammate_ask 工具
 */
export function createTeammateAskTool() {
  return {
    label: "Teammate Ask",
    name: "teammate_ask",
    description: 'Ask a teammate a question and wait for their response synchronously. Use this when you need an immediate answer.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Name of the teammate to ask',
        },
        question: {
          type: 'string',
          description: 'Question to ask',
        },
        timeout_ms: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 60000)',
        },
      },
      required: ['to', 'question'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const to = params.to as string;
        const question = params.question as string;
        const timeoutMs = (params.timeout_ms as number) || 60000;

        if (!to || !question) {
          return errorResult('to and question are required');
        }

        // 检查队友是否存在
        const { listTeammates } = await import('../../agents/teammate.js');
        const teammates = listTeammates();
        const teammateExists = teammates.some(t => t.name === to && t.status !== 'SHUTDOWN');

        if (!teammateExists) {
          return errorResult(`Teammate "${to}" not found or is shut down`);
        }

        // 创建请求记录
        const request: AskRequest = {
          id: `ask_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          from: 'lead',
          to,
          question,
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + timeoutMs,
        };

        saveRequest(request);

        // 发送问题消息给队友
        const { sendToTeammate } = await import('../../agents/teammate.js');
        const message = `[Question #${request.id}]\n\n${question}\n\nPlease answer this question. Your response will be recorded.`;
        sendToTeammate('lead', to, message, 'ask');

        // 同步等待响应
        const result = waitForAnswer(request.id, timeoutMs);

        if (!result) {
          return errorResult('Request not found');
        }

        if (result.status === 'timeout') {
          return jsonResult({
            status: 'timeout',
            question,
            message: `Timed out waiting for response from ${to}`,
          });
        }

        if (result.status === 'answered') {
          return jsonResult({
            status: 'answered',
            question,
            answer: result.answer,
            from: result.to,
            response_time_ms: result.answeredAt! - result.createdAt,
          });
        }

        return jsonResult({
          status: result.status,
          question,
        });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}

/**
 * 回答问题（供队友调用）
 */
export async function answerAsk(askId: string, answer: string): Promise<void> {
  const request = loadRequest(askId);
  if (request && request.status === 'pending') {
    request.status = 'answered';
    request.answer = answer;
    request.answeredAt = Date.now();
    saveRequest(request);
  }
}
