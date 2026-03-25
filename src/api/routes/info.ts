/**
 * Info API Routes
 */

import { Router, Request, Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 全局 Agent 运行状态
interface WorkflowState {
  active: boolean;
  run_id: string | null;
  input: string | null;
  status: string | null;
  phase: string | null;
  sub_agents: Array<{
    agent_id: string;
    agent_type: string;
    status: string;
    input: string;
  }>;
  flow: Array<Record<string, unknown>>;
}

interface AgentTeamState {
  agents: Array<{
    agent_id: string;
    name: string;
    description: string;
    role: string;
    status: string;
  }>;
  active_sub_agents: Record<string, unknown>;
  current_task: {
    active: boolean;
    input: string | null;
    status: string | null;
  };
}

// 全局状态存储
let workflowState: WorkflowState = {
  active: false,
  run_id: null,
  input: null,
  status: null,
  phase: null,
  sub_agents: [],
  flow: [],
};

let agentTeamState: AgentTeamState = {
  agents: [],
  active_sub_agents: {},
  current_task: { active: false, input: null, status: null },
};

let interactionsState: Array<{
  run_id: string;
  source: string;
  target: string;
  type: string;
  task: string;
  status: string;
  timestamp: number;
}> = [];

// 导出设置函数供其他模块使用
export function setWorkflowState(state: Partial<WorkflowState>) {
  workflowState = { ...workflowState, ...state };
}

export function setAgentTeamState(state: Partial<AgentTeamState>) {
  agentTeamState = { ...agentTeamState, ...state };
}

export function addInteraction(interaction: {
  run_id: string;
  source: string;
  target: string;
  type: string;
  task: string;
  status: string;
}) {
  interactionsState.push({
    ...interaction,
    timestamp: Math.floor(Date.now() / 1000),
  });
  // 只保留最近 50 条
  if (interactionsState.length > 50) {
    interactionsState = interactionsState.slice(-50);
  }
}

export function createInfoRouter(): Router {
  const router = Router();

  // GET /info/summary
  router.get('/info/summary', (req: Request, res: Response) => {
    res.json({
      total_runs: 0,
      success: 0,
      failed: 0,
      error: 0,
      avg_duration: 0,
      route_stats: {}
    });
  });

  // GET /info/routes
  router.get('/info/routes', (req: Request, res: Response) => {
    res.json({ routes: [] });
  });

  // GET /info/runs
  router.get('/info/runs', (req: Request, res: Response) => {
    res.json({ runs: [] });
  });

  // GET /info/workflow/current
  router.get('/info/workflow/current', (req: Request, res: Response) => {
    res.json(workflowState);
  });

  // GET /info/workflow/latest
  router.get('/info/workflow/latest', (req: Request, res: Response) => {
    res.json({ runs: [] });
  });

  // GET /info/agent-team - 从 config.json 加载 teammates
  router.get('/info/agent-team', (req: Request, res: Response) => {
    // 尝试从 teammates config.json 加载
    const configPath = path.join(process.cwd(), 'storage', 'teammates', 'config.json');
    let teammatesAgents: AgentTeamState['agents'] = [];

    try {
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const teammates = configData.teammates || [];

        // 转换为 agents 格式
        teammatesAgents = teammates.map((t: { name: string; role: string; status: string }) => ({
          agent_id: t.name,
          name: t.name,
          description: t.role || '',
          role: t.role || '',
          status: t.status?.toLowerCase() || 'idle',
        }));
      }
    } catch (error) {
      console.error('[InfoAPI] Failed to load teammates config:', error);
    }

    // Core Brain 始终显示
    const coreAgent: AgentTeamState['agents'][0] = {
      agent_id: 'core_brain',
      name: 'Core Brain',
      description: 'Central Coordinator',
      role: 'coordinator',
      status: 'idle',
    };

    // 合并 Core Brain 和 teammates
    const agents = [coreAgent, ...teammatesAgents];

    res.json({
      agents,
      active_sub_agents: agentTeamState.active_sub_agents,
      current_task: agentTeamState.current_task,
    });
  });

  // GET /info/agent/:agent_id/details
  router.get('/info/agent/:agent_id/details', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;

    // 如果是 Core Brain，返回默认配置
    if (agent_id === 'core_brain') {
      res.json({
        agent_id,
        name: 'Core Brain',
        description: 'Central Coordinator',
        role: 'coordinator',
        soul: '你是中央协调者，负责协调多个 agent 完成复杂任务。',
        skill: '',
        memory: '',
        current_task: null,
        sub_agents: [],
        status: 'inactive',
        project_id: req.query.project_id || undefined
      });
      return;
    }

    // 尝试从 teammates config 读取
    const configPath = path.join(process.cwd(), 'storage', 'teammates', 'config.json');
    try {
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const teammate = configData.teammates?.find((t: { name: string }) => t.name === agent_id);

        if (teammate) {
          res.json({
            agent_id: teammate.name,
            name: teammate.name,
            description: teammate.role || '',
            role: teammate.role || '',
            soul: teammate.prompt || '',
            skill: '',
            memory: '',
            current_task: null,
            sub_agents: [],
            status: teammate.status?.toLowerCase() || 'inactive',
            project_id: req.query.project_id || undefined
          });
          return;
        }
      }
    } catch (error) {
      console.error('[InfoAPI] Failed to load teammate config:', error);
    }

    // 默认返回空
    res.json({
      agent_id,
      name: agent_id,
      description: '',
      role: '',
      soul: '',
      skill: '',
      memory: '',
      current_task: null,
      sub_agents: [],
      status: 'inactive',
      project_id: req.query.project_id || undefined
    });
  });

  // GET /info/agent/:agent_id/loaded-docs
  router.get('/info/agent/:agent_id/loaded-docs', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;
    res.json({
      agent_id,
      loaded_docs: {},
      doc_count: 0
    });
  });

  // GET /info/interactions
  router.get('/info/interactions', (req: Request, res: Response) => {
    res.json({ interactions: interactionsState });
  });

  // GET /info/interactions/:source/:target
  router.get('/info/interactions/:source/:target', (req: Request, res: Response) => {
    res.json({ interactions: [] });
  });

  // GET /info/thinking/modes
  router.get('/info/thinking/modes', (req: Request, res: Response) => {
    res.json({
      modes: [
        { value: 'standard', name: 'Standard', description: 'Default thinking mode' },
        { value: 'high', name: 'High', description: 'High reasoning' }
      ]
    });
  });

  // GET /info/thoughts/:session_id
  router.get('/info/thoughts/:session_id', (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    res.json({
      session_id,
      steps: [],
      is_complete: true,
      total_duration_ms: 0
    });
  });

  // POST /info/thinking/config
  router.post('/info/thinking/config', (req: Request, res: Response) => {
    res.json({ status: 'success', ...req.body });
  });

  // POST /info/files/batch
  router.post('/info/files/batch', (req: Request, res: Response) => {
    const { file_paths = [] } = req.body;
    const files: Record<string, { exists: boolean; error?: string }> = {};
    for (const path of file_paths) {
      files[path] = { exists: false, error: 'File not found' };
    }
    res.json({ files });
  });

  return router;
}
