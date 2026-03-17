/**
 * Info API Routes
 */

import { Router, Request, Response } from 'express';

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
    res.json({
      active: false,
      run_id: null,
      input: null,
      status: null,
      phase: null,
      sub_agents: [],
      flow: []
    });
  });

  // GET /info/workflow/latest
  router.get('/info/workflow/latest', (req: Request, res: Response) => {
    res.json({ runs: [] });
  });

  // GET /info/agent-team
  router.get('/info/agent-team', (req: Request, res: Response) => {
    res.json({
      agents: [],
      active_sub_agents: {},
      current_task: { active: false, input: null, status: null }
    });
  });

  // GET /info/agent/:agent_id/details
  router.get('/info/agent/:agent_id/details', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;
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
    res.json({ interactions: [] });
  });

  // GET /info/interactions/:source/:target
  router.get('/info/interactions/:source/:target', (req: Request, res: Response) => {
    res.json({ interactions: [] });
  });

  // GET /thinking/modes
  router.get('/thinking/modes', (req: Request, res: Response) => {
    res.json({
      modes: [
        { value: 'standard', name: 'Standard', description: 'Default thinking mode' },
        { value: 'high', name: 'High', description: 'High reasoning' }
      ]
    });
  });

  // GET /thoughts/:session_id
  router.get('/thoughts/:session_id', (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    res.json({
      session_id,
      steps: [],
      is_complete: true,
      total_duration_ms: 0
    });
  });

  // POST /thinking/config
  router.post('/thinking/config', (req: Request, res: Response) => {
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
