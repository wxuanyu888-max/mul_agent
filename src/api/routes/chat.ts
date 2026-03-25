/**
 * Chat API Routes
 */

import { Router, Request, Response } from 'express';
import { messageQueue } from '../../message/index.js';
import { AgentLoop } from '../../agents/loop.js';
import type { Message, SessionMessage } from '../../agents/types.js';
import { querySessions, getSession, deleteSession, updateSession, createSession } from '../../session/manager.js';
import { executeCommand, listCommands, type CommandContext } from '../../commands/index.js';
import { getSessionsPath } from '../../utils/path.js';
import { setWorkflowState, setAgentTeamState, addInteraction } from './info.js';
import { listTeammates } from '../../agents/teammate.js';
import { setCronSSECallback, getCronManager } from '../../tools/system/cron-manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Session 存储目录
const SESSIONS_DIR = getSessionsPath();

// SSE 连接管理
const sseConnections: Map<string, Response> = new Map();

/**
 * 注册 SSE 连接
 */
export function registerSSEConnection(sessionId: string, res: Response): void {
  sseConnections.set(sessionId, res);
  console.log(`[SSE] Connected: ${sessionId}, total: ${sseConnections.size}`);
}

/**
 * 取消注册 SSE 连接
 */
export function unregisterSSEConnection(sessionId: string): void {
  sseConnections.delete(sessionId);
  console.log(`[SSE] Disconnected: ${sessionId}, total: ${sseConnections.size}`);
}

/**
 * 向 SSE 连接发送事件
 */
export function sendSSEEvent(sessionId: string, eventType: string, data: Record<string, unknown>): boolean {
  const res = sseConnections.get(sessionId);
  if (!res) {
    return false;
  }

  try {
    res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`);
    return true;
  } catch (error) {
    console.error(`[SSE] Failed to send event to ${sessionId}:`, error);
    sseConnections.delete(sessionId);
    return false;
  }
}

// 确保目录存在
async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // 目录已存在，忽略错误
  }
}
ensureDir(SESSIONS_DIR);

// In-memory storage for chat sessions (统一消息格式，包含完整 tool_use/tool_result)
const messagesStore: Record<string, SessionMessage[]> = {};

/**
 * 持久化 session 到文件，同时更新 index
 */
async function saveSession(sessionId: string, messages: SessionMessage[]) {
  const now = Date.now();

  // 获取第一条用户消息作为 label
  const firstUserMessage = messages.find((m) => m.role === 'user');
  const label = firstUserMessage?.content?.substring(0, 100) || '新对话';

  // 检查 session 是否已存在
  const existingSession = await getSession(sessionId);

  if (existingSession) {
    // 更新已存在的 session
    await updateSession(sessionId, {
      label,
      updatedAt: now,
      messages: messages as any,
    });
  } else {
    // 创建新 session（使用传入的 sessionId）
    await createSession({
      id: sessionId,
      label,
      parentId: 'default',
      config: { runtime: 'main' },
    });
    // 更新消息
    await updateSession(sessionId, {
      messages: messages as any,
    });
  }
}

/**
 * 从文件加载 session
 */
async function loadSession(sessionId: string): Promise<SessionMessage[]> {
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  try {
    const content = await fs.readFile(sessionFile, 'utf-8');
    const data = JSON.parse(content);
    return data.messages || [];
  } catch {
    return [];
  }
}

/**
 * 处理 Cron 触发时重新调用 agent
 */
async function handleCronAgentRun(sessionId: string, agentId: string | undefined, task: string): Promise<void> {
  console.log(`[Cron] Triggering agent for session ${sessionId}, task: ${task}`);

  try {
    // 1. 加载 session 历史消息
    const historyMessages = await loadSession(sessionId);

    // 2. 准备新消息（cron 任务作为用户消息）
    const enhancedMessage = `[定时任务触发] ${task}`;

    // 3. 获取 SSE 连接
    const res = sseConnections.get(sessionId);
    if (!res) {
      console.warn(`[Cron] No SSE connection for session ${sessionId}`);
      return;
    }

    // 4. 获取额外的 system prompt（如果指定了 agent_id）
    const teammates = listTeammates();
    const targetTeammate = agentId ? teammates.find(t => t.name === agentId) : null;
    const extraSystemPrompt = targetTeammate?.prompt || '';

    // 5. 发送初始状态
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Cron 任务触发，重新调用 Agent...' })}\n\n`);

    // 6. 创建 AgentLoop 实例
    const agent = new AgentLoop({
      maxIterations: 50,
      workspaceDir: process.cwd(),
      sessionId,
      promptMode: 'full',
      extraSystemPrompt,

      onToolConfirm: async (_tool) => true,

      onLlmCall: (_messages, _systemPrompt) => {
        // 可用于调试
      },

      onLlmResponse: (_response) => {
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'LLM 响应中...' })}\n\n`);
      },

      onSseWrite: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    });

    // 7. 注册默认工具
    agent.registerDefaultTools();

    // 8. 运行 agent
    res.write(`data: ${JSON.stringify({ type: 'status', message: '正在处理定时任务...' })}\n\n`);

    const result = await agent.run({
      message: enhancedMessage,
      history: historyMessages,
    });

    // 9. 发送结果
    res.write(`data: ${JSON.stringify({ type: 'response', response: result.content, conversation_id: sessionId })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);

    console.log(`[Cron] Agent run completed for session ${sessionId}, iterations: ${result.iterations}`);
  } catch (error) {
    console.error(`[Cron] Failed to run agent for session ${sessionId}:`, error);
    const res = sseConnections.get(sessionId);
    if (res) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: `Cron 任务执行失败: ${error}` })}\n\n`);
    }
  }
}

export function createChatRouter(): Router {
  const router = Router();

  // 设置 Cron SSE 回调 - 当 cron 任务触发时发送 SSE 事件并重新调用 agent
  setCronSSECallback((eventType: string, data: Record<string, unknown>) => {
    const sessionId = data.sessionId as string | undefined;
    const agentId = data.agentId as string | undefined;
    const task = data.task as string | undefined;

    if (sessionId) {
      // 发送给特定 session
      sendSSEEvent(sessionId, eventType, data);

      // 如果有 task 且有活跃的 SSE 连接，重新调用 agent
      if (task && sseConnections.has(sessionId)) {
        // 使用 setImmediate 在后台异步执行，避免阻塞 cron 检查循环
        setImmediate(() => handleCronAgentRun(sessionId, agentId, task));
      }
    } else {
      // 没有指定 session 时，广播到所有连接（供前端全局通知）
      for (const [sid, _res] of sseConnections) {
        sendSSEEvent(sid, eventType, data);
      }
    }
  });

  // POST /chat - 加入消息队列
  router.post('/chat', (req: Request, res: Response) => {
    const { message, agent_id: _agent_id, conversation_id } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const session_id = conversation_id || `session_${Date.now()}`;

    // 加入消息队列（不阻塞等待处理）
    const result = messageQueue.enqueue(session_id, message);

    res.json({
      status: 'queued',
      message_id: result.message_id,
      conversation_id: session_id,
      queue_status: result.queue_status
    });
  });

  // POST /chat/process - 触发处理下一条消息
  router.post('/chat/process', (req: Request, res: Response) => {
    const { conversation_id } = req.body;

    // 获取下一条待处理消息
    const msg = messageQueue.dequeue(conversation_id || '');

    if (!msg) {
      res.json({
        status: 'idle',
        message: 'No pending messages'
      });
      return;
    }

    // 模拟处理（实际的 agent 处理在 /chat/stream 端点）
    const responseText = `处理中: ${msg.content}`;

    // 记录消息
    if (!messagesStore[msg.sessionKey]) {
      messagesStore[msg.sessionKey] = [];
    }
    messagesStore[msg.sessionKey].push({ role: 'user', content: msg.content });
    messagesStore[msg.sessionKey].push({ role: 'assistant', content: responseText });

    // 标记完成
    messageQueue.complete(msg.id);

    res.json({
      status: 'processing',
      message_id: msg.id,
      response: responseText,
      queue_status: messageQueue.getStatus(msg.sessionKey)
    });
  });

  // GET /chat/queue/:session_id - 获取队列状态
  router.get('/chat/queue/:session_id', (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    res.json(messageQueue.getStatus(session_id));
  });

  // GET /chat/queue - 获取所有队列状态
  router.get('/chat/queue', (req: Request, res: Response) => {
    res.json(messageQueue.getAllStatus());
  });

  // DELETE /chat/queue/:session_id - 清空队列
  router.delete('/chat/queue/:session_id', (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    messageQueue.clear(session_id);
    res.json({ status: 'success', message: 'Queue cleared' });
  });

  // GET /chat/history
  router.get('/chat/history', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const session_id = req.query.session_id as string;

    let messages: Array<{ role: string; content: string }> = [];

    if (session_id && messagesStore[session_id]) {
      messages = messagesStore[session_id].slice(-limit);
    } else {
      // Return all messages from all sessions
      for (const msgs of Object.values(messagesStore)) {
        messages.push(...msgs);
      }
      messages = messages.slice(-limit);
    }

    // 同时返回队列状态
    const queueStatus = session_id
      ? messageQueue.getStatus(session_id)
      : undefined;

    res.json({
      history: messages,
      total: messages.length,
      queue_status: queueStatus,
      sessions: []
    });
  });

  // GET /chat/sessions
  router.get('/chat/sessions', async (req: Request, res: Response) => {
    const agent_id = req.query.agent_id as string;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      // 使用真正的 session 管理器查询
      const sessions = await querySessions({
        parentId: agent_id,
        limit,
      });

      // 转换为前端需要的格式
      const sessionList = sessions.map((s) => ({
        session_id: s.id,
        agent_id: s.parentId || s.config?.runtime || 'default',
        created_at: new Date(s.createdAt).toISOString(),
        last_message_at: new Date(s.updatedAt).toISOString(),
        message_count: 0, // 需要另外查询
        preview: s.label || '',
        first_message: s.label || '',
      }));

      res.json({ sessions: sessionList });
    } catch (error) {
      console.error('Failed to query sessions:', error);
      res.json({ sessions: [] });
    }
  });

  // GET /chat/session/:session_id
  router.get('/chat/session/:session_id', async (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    const limit = parseInt(req.query.limit as string) || 100;

    try {
      // 使用真正的 session 管理器获取消息
      const session = await getSession(session_id);

      if (!session) {
        res.status(404).json({
          error: 'Session not found',
          session_id,
        });
        return;
      }

      // 从 session 中获取消息
      const messages = (session.messages || []).slice(-limit);

      res.json({
        session_id,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp || Date.now()).toISOString(),
        })),
        total: session.messages?.length || 0,
      });
    } catch (error) {
      console.error('Failed to get session:', error);
      res.json({
        session_id,
        messages: [],
        total: 0,
      });
    }
  });

  // DELETE /chat/session/:session_id
  router.delete('/chat/session/:session_id', async (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;

    try {
      // 使用真正的 session 管理器删除
      await deleteSession(session_id);
      // 同时清空队列
      messageQueue.clear(session_id);
      res.json({ status: 'success', message: 'Session deleted' });
    } catch (error) {
      console.error('Failed to delete session:', error);
      res.json({ status: 'error', message: 'Failed to delete session' });
    }
  });

  // SSE Stream endpoint for real-time chat
  router.post('/chat/stream', async (req: Request, res: Response) => {
    const { message, agent_id, conversation_id, attachments } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const session_id = conversation_id || `session_${Date.now()}`;

    // 处理附件内容，构建增强的消息
    let enhancedMessage = message;
    if (attachments && attachments.length > 0) {
      const attachmentContents = attachments
        .filter((a: any) => a.extractedText && a.extractedText.trim())
        .map((a: any) => {
          const typeLabel = a.type === 'image' ? '[图片]' : '[文档]';
          return `${typeLabel} ${a.originalName}:\n${a.extractedText}`;
        });

      if (attachmentContents.length > 0) {
        enhancedMessage = `${message}\n\n--- 附件内容 ---\n${attachmentContents.join('\n\n')}`;
      }
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 注册 SSE 连接
    registerSSEConnection(session_id, res);

    // 根据 agent_id 获取不同的 prompt 配置
    const teammates = listTeammates();

    // 处理 All Agents 广播模式
    if (agent_id === '__all__') {
      await handleBroadcastChat(req, res, enhancedMessage, session_id, teammates);
      return;
    }

    // 单个 agent 模式
    const targetTeammate = teammates.find(t => t.name === agent_id);

    // 设置 Agent Team 状态
    const agentInfo = targetTeammate
      ? { agent_id: targetTeammate.name, name: targetTeammate.name, description: targetTeammate.role, role: targetTeammate.role, status: 'running' }
      : { agent_id: 'core_brain', name: 'Core Brain', description: 'Central Coordinator', role: 'coordinator', status: 'running' };

    setAgentTeamState({
      agents: [agentInfo],
      active_sub_agents: {},
      current_task: { active: true, input: message, status: 'running' },
    });

    // Initialize message store for session - 优先从文件加载
    if (!messagesStore[session_id]) {
      messagesStore[session_id] = await loadSession(session_id);
    }

    // 设置工作流状态为活跃
    setWorkflowState({
      active: true,
      run_id: session_id,
      input: message,
      status: 'running',
      phase: 'thinking',
      sub_agents: [],
      flow: [],
    });

    // 设置 Agent Team 状态
    setAgentTeamState({
      agents: [{
        agent_id: 'core_brain',
        name: 'Core Brain',
        description: 'Central Coordinator',
        role: 'coordinator',
        status: 'running',
      }],
      active_sub_agents: {},
      current_task: { active: true, input: message, status: 'running' },
    });

    // 记录交互
    addInteraction({
      run_id: session_id,
      source: 'user',
      target: 'core_brain',
      type: 'chat',
      task: message,
      status: 'executing',
    });

    // Send status: start
    res.write(`data: ${JSON.stringify({ type: 'status', message: '开始处理...' })}\n\n`);

    try {
      // 检测是否是命令
      const commandContext: CommandContext = {
        sessionId: session_id,
        surface: 'api',
        channel: 'chat',
      };

      const commandResult = await executeCommand(commandContext, message);

      // 如果是命令且不需要继续，直接返回命令结果
      if (!commandResult.shouldContinue) {
        res.write(`data: ${JSON.stringify({
          type: 'command_response',
          content: commandResult.reply?.text || commandResult.reply?.markdown || 'Command executed',
        })}\n\n`);
        res.end();
        return;
      }

      // 如果是命令但需要继续，先发送命令响应然后继续执行
      if (commandResult.reply) {
        res.write(`data: ${JSON.stringify({
          type: 'command_response',
          content: commandResult.reply?.text || commandResult.reply?.markdown,
        })}\n\n`);
      }

      // Get conversation history (统一格式，包含完整 tool_use/tool_result)
      const history = messagesStore[session_id] || [];

      // 转换历史消息为 Message 格式（保持完整结构）
      const historyMessages: Message[] = history.map((msg, idx) => ({
        id: `msg_${idx}_${Date.now()}`,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        toolCalls: msg.tool_calls as any,
        timestamp: msg.timestamp ?? Date.now(),
      }));

      // 创建 AgentLoop 实例
      const initStart = Date.now();

      // 根据 agent_id 获取额外的 system prompt
      const teammates = listTeammates();
      const targetTeammate = teammates.find(t => t.name === agent_id);
      const extraSystemPrompt = targetTeammate?.prompt || '';

      const agent = new AgentLoop({
        maxIterations: 50,
        workspaceDir: process.cwd(),
        sessionId: session_id,
        promptMode: 'full',
        extraSystemPrompt,

        // 回调：工具确认（自动确认执行）
        onToolConfirm: async (_tool) => {
          return true;
        },

        // 回调：工具执行（工具结果已包含在消息历史中，无需单独发给前端）

        // 回调：LLM 调用
        onLlmCall: (_messages, _systemPrompt) => {
          // 可用于调试
        },

        // 回调：LLM 响应
        onLlmResponse: (_response) => {
          res.write(`data: ${JSON.stringify({ type: 'status', message: 'LLM 响应中...' })}\n\n`);
        },

        // 回调：SSE 写入 - 发送工具执行事件给前端
        onSseWrite: (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
      });

      // 注册所有默认工具
      const registerStart = Date.now();
      agent.registerDefaultTools();
      const registerTime = Date.now() - registerStart;

      // Send status: thinking
      const totalInitTime = Date.now() - initStart;
      res.write(`data: ${JSON.stringify({ type: 'status', message: `初始化完成 (${totalInitTime}ms), 注册工具 (${registerTime}ms)` })}\n\n`);

      // 使用 AgentLoop 处理消息
      const startTime = Date.now();
      const result = await agent.run({
        message: enhancedMessage,
        history: historyMessages,
      });

      const elapsed = Date.now() - startTime;

      // Send status: completed
      res.write(`data: ${JSON.stringify({ type: 'status', message: `处理完成 (${elapsed}ms), 迭代: ${result.iterations}, 工具调用: ${result.toolCalls}` })}\n\n`);

      // 更新工作流状态为完成
      setWorkflowState({
        active: false,
        status: 'completed',
        phase: 'completed',
      });

      // 更新 Agent Team 状态
      setAgentTeamState({
        agents: [{
          agent_id: 'core_brain',
          name: 'Core Brain',
          description: 'Central Coordinator',
          role: 'coordinator',
          status: 'completed',
        }],
        current_task: { active: false, input: null, status: 'completed' },
      });

      // 更新交互状态
      addInteraction({
        run_id: session_id,
        source: 'user',
        target: 'core_brain',
        type: 'chat',
        task: message,
        status: 'completed',
      });

      // Send the response
      res.write(`data: ${JSON.stringify({ type: 'response', response: result.content, conversation_id: session_id })}\n\n`);

      // Send complete
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);

      // Store full messages in memory (包含完整的 tool_use/tool_result)
      // result.messages 已经包含完整的历史，直接替换
      if (result.messages && result.messages.length > 0) {
        messagesStore[session_id] = result.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.tool_calls,
          tool_call_id: msg.tool_call_id,
          name: msg.name,
          timestamp: Date.now(),
        }));
      } else {
        // 兼容：如果没有 result.messages，回退到旧逻辑
        messagesStore[session_id].push({ role: 'user', content: message, timestamp: Date.now() });
        messagesStore[session_id].push({ role: 'assistant', content: result.content, timestamp: Date.now() });
      }

      // 持久化 session 到文件
      await saveSession(session_id, messagesStore[session_id]);

    } catch (error) {
      console.error('Chat stream error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    } finally {
      unregisterSSEConnection(session_id);
      res.end();
    }
  });

  // 处理广播模式 - 发送给所有 teammates
  async function handleBroadcastChat(
    req: Request,
    res: Response,
    message: string,
    session_id: string,
    teammates: { name: string; role: string; prompt?: string }[]
  ) {
    try {
      // 处理附件内容
      const attachments = (req.body as any).attachments;
      let enhancedMessage = message;
      if (attachments && attachments.length > 0) {
        const attachmentContents = attachments
          .filter((a: any) => a.extractedText && a.extractedText.trim())
          .map((a: any) => {
            const typeLabel = a.type === 'image' ? '[图片]' : '[文档]';
            return `${typeLabel} ${a.originalName}:\n${a.extractedText}`;
          });

        if (attachmentContents.length > 0) {
          enhancedMessage = `${message}\n\n--- 附件内容 ---\n${attachmentContents.join('\n\n')}`;
        }
      }

      // 加载当前 session 的消息历史
      if (!messagesStore[session_id]) {
        messagesStore[session_id] = await loadSession(session_id);
      }

      // 设置工作流状态
      setWorkflowState({
        active: true,
        run_id: session_id,
        input: enhancedMessage,
      status: 'running',
      phase: 'broadcasting',
      sub_agents: [],
      flow: [],
    });

    // 设置 Agent Team 状态 - 显示所有 agents
    const allAgentInfos = teammates.map(t => ({
      agent_id: t.name,
      name: t.name,
      description: t.role,
      role: t.role,
      status: 'running' as const,
    }));

    setAgentTeamState({
      agents: allAgentInfos,
      active_sub_agents: {},
      current_task: { active: true, input: message, status: 'running' },
    });

    res.write(`data: ${JSON.stringify({ type: 'status', message: `正在广播给 ${teammates.length} 个 agents...` })}\n\n`);

    // 为每个 teammate 创建独立的 AgentLoop 处理（并行）
    const results = await Promise.all(
      teammates.map(async (teammate) => {
        const historyMessages: Message[] = messagesStore[session_id].map((msg) => ({
          id: `msg_${Date.now()}_${Math.random()}`,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp || Date.now(),
        }));

        const agent = new AgentLoop({
          maxIterations: 30,
          workspaceDir: process.cwd(),
          sessionId: `${session_id}_${teammate.name}`,
          promptMode: 'full',
          extraSystemPrompt: teammate.prompt || '',
          onToolConfirm: async () => true,
          onLlmResponse: () => {},
          onSseWrite: (event) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          },
        });

        const result = await agent.run({
          message: enhancedMessage,
          history: historyMessages,
        });

        return {
          name: teammate.name,
          response: result.content,
        };
      })
    );

    // 分别返回每个 agent 的响应
    for (const r of results) {
      res.write(`data: ${JSON.stringify({
        type: 'agent_response',
        agent_id: r.name,
        agent_name: r.name,
        response: r.response,
        conversation_id: session_id
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();

    } catch (error) {
      console.error('Broadcast chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.end();
    }
  }

  return router;
}
