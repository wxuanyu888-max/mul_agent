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

// Global LLM config storage
const globalConfig: { url: string; provider: string; model: string; has_key: boolean } = {
  url: '',
  provider: 'openai',
  model: 'gpt-4',
  has_key: false
};

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
    const { integrations: _integrations } = req.body;

    // Just acknowledge the reorder request
    res.json({ status: 'success', message: 'Integrations reordered' });
  });

  // Global LLM Config endpoints
  // GET /llm-config
  router.get('/llm-config', (req: Request, res: Response) => {
    res.json({
      url: globalConfig.url || '',
      provider: globalConfig.provider || 'openai',
      model: globalConfig.model || 'gpt-4',
      has_key: !!globalConfig.has_key
    });
  });

  // POST /llm-config
  router.post('/llm-config', (req: Request, res: Response) => {
    const { url, provider, model, key } = req.body;
    globalConfig.url = url || '';
    globalConfig.provider = provider || 'openai';
    globalConfig.model = model || 'gpt-4';
    if (key) globalConfig.has_key = true;
    res.json({
      status: 'success',
      url: globalConfig.url,
      provider: globalConfig.provider,
      model: globalConfig.model,
      has_key: globalConfig.has_key
    });
  });

  // DELETE /llm-config
  router.delete('/llm-config', (req: Request, res: Response) => {
    globalConfig.url = '';
    globalConfig.provider = 'openai';
    globalConfig.model = 'gpt-4';
    globalConfig.has_key = false;
    res.json({ status: 'success', message: 'Global config deleted' });
  });

  return router;
}
