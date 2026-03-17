/**
 * Agents API Routes
 */

import { Router, Request, Response } from 'express';

// In-memory storage for agents
const agentsStore: Record<string, Record<string, unknown>> = {};

export function createAgentsRouter(): Router {
  const router = Router();

  // GET /agents
  router.get('/agents', (req: Request, res: Response) => {
    res.json({ agents: Object.values(agentsStore) });
  });

  // GET /agents/:agent_id
  router.get('/agents/:agent_id', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;
    const agent = agentsStore[agent_id];

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json({
      agent_id,
      name: agent.name || agent_id,
      description: agent.description || '',
      role: agent.role || '',
      soul: { content: agent.soul || '' },
      user: { content: '' },
      skill: { content: agent.skill || '' },
      memory: { content: '' }
    });
  });

  // GET /agents/:agent_id/config
  router.get('/agents/:agent_id/config', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;
    const agent = agentsStore[agent_id] || {};
    const configType = (req.query.config_type as string) || 'all';

    const configs: Record<string, { content: string }> = {};

    if (configType === 'all' || configType === 'soul') {
      configs.soul = { content: String(agent.soul || '') };
    }
    if (configType === 'all' || configType === 'skill') {
      configs.skill = { content: String(agent.skill || '') };
    }
    if (configType === 'all' || configType === 'user') {
      configs.user = { content: '' };
    }
    if (configType === 'all' || configType === 'memory') {
      configs.memory = { content: '' };
    }

    res.json(configs);
  });

  // PUT /agents/:agent_id/config
  router.put('/agents/:agent_id/config', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;
    const { config_type, content, metadata } = req.body;

    if (!agentsStore[agent_id]) {
      agentsStore[agent_id] = {};
    }

    if (config_type === 'soul') {
      agentsStore[agent_id].soul = content;
    } else if (config_type === 'skill') {
      agentsStore[agent_id].skill = content;
    } else if (config_type === 'user') {
      agentsStore[agent_id].user = content;
    } else if (config_type === 'memory') {
      agentsStore[agent_id].memory = content;
    }

    res.json({ status: 'success', agent_id, config_type });
  });

  // GET /agents/:agent_id/status
  router.get('/agents/:agent_id/status', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;
    res.json({
      agent_id,
      status: 'inactive',
      session_id: null
    });
  });

  return router;
}
