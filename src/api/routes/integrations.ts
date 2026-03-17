/**
 * Integrations API Routes
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

interface Integration {
  id: string;
  name: string;
  url: string;
  provider: string;
  model?: string;
  icon?: string;
  status: 'active' | 'inactive';
  has_key: boolean;
  created_at?: string;
  updated_at?: string;
}

// In-memory integrations storage
const integrationsStore: Record<string, Integration> = {};

export function createIntegrationsRouter(): Router {
  const router = Router();

  // GET /integrations
  router.get('/integrations', (req: Request, res: Response) => {
    res.json({ integrations: Object.values(integrationsStore) });
  });

  // GET /integrations/:integration_id
  router.get('/integrations/:integration_id', (req: Request, res: Response) => {
    const integration_id = req.params.integration_id as string;
    const integration = integrationsStore[integration_id];

    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    res.json(integration);
  });

  // POST /integrations
  router.post('/integrations', (req: Request, res: Response) => {
    const { name, url, provider, model, key, icon } = req.body;

    const id = randomUUID();
    const now = new Date().toISOString();

    const integration: Integration = {
      id,
      name: name || 'New Integration',
      url: url || '',
      provider: provider || 'unknown',
      model,
      icon,
      status: 'inactive',
      has_key: !!key,
      created_at: now,
      updated_at: now
    };

    integrationsStore[id] = integration;

    res.json({ status: 'success', integration });
  });

  // PUT /integrations/:integration_id
  router.put('/integrations/:integration_id', (req: Request, res: Response) => {
    const integration_id = req.params.integration_id as string;
    const { name, url, provider, model, key, icon, status } = req.body;

    if (!integrationsStore[integration_id]) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const integration = integrationsStore[integration_id];

    if (name) integration.name = name;
    if (url) integration.url = url;
    if (provider) integration.provider = provider;
    if (model) integration.model = model;
    if (key) integration.has_key = true;
    if (icon) integration.icon = icon;
    if (status) integration.status = status;
    integration.updated_at = new Date().toISOString();

    res.json({ status: 'success', integration });
  });

  // DELETE /integrations/:integration_id
  router.delete('/integrations/:integration_id', (req: Request, res: Response) => {
    const integration_id = req.params.integration_id as string;

    if (integrationsStore[integration_id]) {
      delete integrationsStore[integration_id];
    }

    res.json({ status: 'success', message: 'Integration deleted' });
  });

  // POST /integrations/:integration_id/duplicate
  router.post('/integrations/:integration_id/duplicate', (req: Request, res: Response) => {
    const integration_id = req.params.integration_id as string;
    const original = integrationsStore[integration_id];

    if (!original) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const duplicate: Integration = {
      ...original,
      id,
      name: `${original.name} (Copy)`,
      created_at: now,
      updated_at: now
    };

    integrationsStore[id] = duplicate;

    res.json({ status: 'success', integration: duplicate });
  });

  // PUT /integrations/reorder
  router.put('/integrations/reorder', (req: Request, res: Response) => {
    const { integrations } = req.body;

    // Just acknowledge the reorder request
    res.json({ status: 'success', message: 'Integrations reordered' });
  });

  return router;
}
