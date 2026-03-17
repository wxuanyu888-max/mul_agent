/**
 * Token Usage API Routes
 */

import { Router, Request, Response } from 'express';

interface TokenUsageSummary {
  agent_id: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  access_count: number;
  last_access_time: string | null;
  updated_at: string | null;
}

interface TokenUsageDetails {
  summary: TokenUsageSummary;
  details: {
    by_model: Record<string, unknown>;
    by_function: Record<string, unknown>;
    by_date: Record<string, unknown>;
  };
  llm_logs: unknown[];
}

// In-memory token usage storage
const tokenUsageStore: Record<string, TokenUsageDetails> = {};

export function createTokenRouter(): Router {
  const router = Router();

  // GET /token-usage
  router.get('/token-usage', (req: Request, res: Response) => {
    const allUsage: Record<string, TokenUsageSummary> = {};

    for (const [agent_id, details] of Object.entries(tokenUsageStore)) {
      allUsage[agent_id] = details.summary;
    }

    res.json({ all_usage: allUsage });
  });

  // GET /token-usage/:agent_id
  router.get('/token-usage/:agent_id', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;

    if (!tokenUsageStore[agent_id]) {
      res.json({
        summary: {
          agent_id,
          total_tokens: 0,
          input_tokens: 0,
          output_tokens: 0,
          access_count: 0,
          last_access_time: null,
          updated_at: null
        },
        details: {
          by_model: {},
          by_function: {},
          by_date: {}
        },
        llm_logs: []
      });
      return;
    }

    res.json(tokenUsageStore[agent_id]);
  });

  // POST /token-usage/:agent_id/reset
  router.post('/token-usage/:agent_id/reset', (req: Request, res: Response) => {
    const agent_id = req.params.agent_id as string;

    if (tokenUsageStore[agent_id]) {
      delete tokenUsageStore[agent_id];
    }

    res.json({ status: 'success', message: `Token usage reset for agent ${agent_id}` });
  });

  return router;
}
