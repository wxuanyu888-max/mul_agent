/**
 * Projects API Routes
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

// In-memory projects storage
const projectsStore: Record<string, { name: string; description: string; created_at: string }> = {};

export function createProjectsRouter(): Router {
  const router = Router();

  // GET /projects
  router.get('/projects', (req: Request, res: Response) => {
    const projects = Object.entries(projectsStore).map(([project_id, project]) => ({
      project_id,
      name: project.name,
      description: project.description,
      created_at: project.created_at,
      agent_count: 0
    }));

    res.json({ projects });
  });

  // GET /projects/:project_id
  router.get('/projects/:project_id', (req: Request, res: Response) => {
    const project_id = req.params.project_id as string;
    const project = projectsStore[project_id];

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({
      project_id,
      name: project.name,
      description: project.description,
      created_at: project.created_at,
      agents: []
    });
  });

  // POST /projects
  router.post('/projects', (req: Request, res: Response) => {
    const { name, description, project_id } = req.body;

    const id = project_id || randomUUID();
    const now = new Date().toISOString();

    projectsStore[id] = {
      name: name || 'Untitled Project',
      description: description || '',
      created_at: now
    };

    res.json({
      status: 'success',
      project_id: id,
      message: 'Project created'
    });
  });

  // DELETE /projects/:project_id
  router.delete('/projects/:project_id', (req: Request, res: Response) => {
    const project_id = req.params.project_id as string;

    if (projectsStore[project_id]) {
      delete projectsStore[project_id];
    }

    res.json({ status: 'success', message: 'Project deleted' });
  });

  // GET /projects/:project_id/agents
  router.get('/projects/:project_id/agents', (req: Request, res: Response) => {
    res.json({ agents: [] });
  });

  return router;
}
