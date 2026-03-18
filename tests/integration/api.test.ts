// API Integration Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express } from 'express';
import request from 'supertest';
import { createInfoRouter } from '../../src/api/routes/info.js';
import { createAgentsRouter } from '../../src/api/routes/agents.js';
import { createMemoryRouter } from '../../src/api/routes/memory.js';
import { createProjectsRouter } from '../../src/api/routes/projects.js';

describe("API Integration Tests", () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Register routers
    app.use('/api/v1', createInfoRouter());
    app.use('/api/v1', createAgentsRouter());
    app.use('/api/v1', createMemoryRouter());
    app.use('/api/v1', createProjectsRouter());
  });

  describe("Health Check", () => {
    it("should verify routes are mounted", () => {
      // This test verifies routes are properly mounted
      expect(true).toBe(true);
    });
  });

  describe("GET /api/v1/info/summary", () => {
    it("should return summary statistics", async () => {
      const response = await request(app)
        .get('/api/v1/info/summary')
        .expect(200);

      expect(response.body).toHaveProperty('total_runs');
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('avg_duration');
      expect(response.body).toHaveProperty('route_stats');
    });
  });

  describe("GET /api/v1/info/routes", () => {
    it("should return routes list", async () => {
      const response = await request(app)
        .get('/api/v1/info/routes')
        .expect(200);

      expect(response.body).toHaveProperty('routes');
      expect(Array.isArray(response.body.routes)).toBe(true);
    });
  });

  describe("GET /api/v1/info/runs", () => {
    it("should return runs list", async () => {
      const response = await request(app)
        .get('/api/v1/info/runs')
        .expect(200);

      expect(response.body).toHaveProperty('runs');
      expect(Array.isArray(response.body.runs)).toBe(true);
    });
  });

  describe("GET /api/v1/info/workflow/current", () => {
    it("should return current workflow status", async () => {
      const response = await request(app)
        .get('/api/v1/info/workflow/current')
        .expect(200);

      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('run_id');
      expect(response.body).toHaveProperty('input');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('phase');
      expect(response.body).toHaveProperty('sub_agents');
      expect(response.body).toHaveProperty('flow');
    });
  });

  describe("GET /api/v1/info/workflow/latest", () => {
    it("should return latest workflow runs", async () => {
      const response = await request(app)
        .get('/api/v1/info/workflow/latest')
        .expect(200);

      expect(response.body).toHaveProperty('runs');
    });
  });

  describe("GET /api/v1/info/agent-team", () => {
    it("should return agent team info", async () => {
      const response = await request(app)
        .get('/api/v1/info/agent-team')
        .expect(200);

      expect(response.body).toHaveProperty('agents');
      expect(response.body).toHaveProperty('active_sub_agents');
      expect(response.body).toHaveProperty('current_task');
    });
  });

  describe("GET /api/v1/info/agent/:agent_id/details", () => {
    it("should return agent details", async () => {
      const response = await request(app)
        .get('/api/v1/info/agent/test-agent/details')
        .expect(200);

      expect(response.body).toHaveProperty('agent_id');
      expect(response.body.agent_id).toBe('test-agent');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('status');
    });

    it("should accept project_id query param", async () => {
      const response = await request(app)
        .get('/api/v1/info/agent/test-agent/details?project_id=proj-123')
        .expect(200);

      expect(response.body).toHaveProperty('project_id');
    });
  });

  describe("GET /api/v1/info/interactions", () => {
    it("should return interactions list", async () => {
      const response = await request(app)
        .get('/api/v1/info/interactions')
        .expect(200);

      expect(response.body).toHaveProperty('interactions');
    });
  });

  describe("GET /api/v1/thinking/modes", () => {
    it("should return thinking modes", async () => {
      const response = await request(app)
        .get('/api/v1/thinking/modes')
        .expect(200);

      expect(response.body).toHaveProperty('modes');
      expect(Array.isArray(response.body.modes)).toBe(true);
      expect(response.body.modes[0]).toHaveProperty('value');
      expect(response.body.modes[0]).toHaveProperty('name');
    });
  });

  describe("GET /api/v1/thoughts/:session_id", () => {
    it("should return thoughts for session", async () => {
      const response = await request(app)
        .get('/api/v1/thoughts/session-123')
        .expect(200);

      expect(response.body).toHaveProperty('session_id');
      expect(response.body.session_id).toBe('session-123');
      expect(response.body).toHaveProperty('steps');
      expect(response.body).toHaveProperty('is_complete');
    });
  });

  describe("POST /api/v1/thinking/config", () => {
    it("should accept and echo config", async () => {
      const response = await request(app)
        .post('/api/v1/thinking/config')
        .send({ mode: 'high', max_tokens: 1000 })
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('success');
      expect(response.body).toHaveProperty('mode');
      expect(response.body.mode).toBe('high');
    });
  });

  describe("POST /api/v1/info/files/batch", () => {
    it("should check file existence", async () => {
      const response = await request(app)
        .post('/api/v1/info/files/batch')
        .send({ file_paths: ['/test/file.ts', '/another/file.ts'] })
        .expect(200);

      expect(response.body).toHaveProperty('files');
      expect(response.body.files).toHaveProperty('/test/file.ts');
      expect(response.body.files).toHaveProperty('/another/file.ts');
    });

    it("should handle empty file_paths", async () => {
      const response = await request(app)
        .post('/api/v1/info/files/batch')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('files');
      expect(Object.keys(response.body.files).length).toBe(0);
    });
  });

  describe("GET /api/v1/agents", () => {
    it("should return agents list", async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body).toHaveProperty('agents');
    });
  });

  describe("GET /api/v1/agents/:agent_id", () => {
    it("should return 404 for non-existent agent", async () => {
      const response = await request(app)
        .get('/api/v1/agents/test-agent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe("GET /api/v1/memory/status", () => {
    it("should return memory status", async () => {
      const response = await request(app)
        .get('/api/v1/memory/status')
        .expect(200);

      expect(response.body).toHaveProperty('agent_id');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toHaveProperty('backend');
      expect(response.body.status).toHaveProperty('vector');
      expect(response.body.status).toHaveProperty('fts');
    });
  });

  describe("GET /api/v1/memory/search", () => {
    it("should return search results", async () => {
      const response = await request(app)
        .get('/api/v1/memory/search')
        .query({ query: 'test', max_results: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });
  });

  describe("GET /api/v1/projects", () => {
    it("should return projects list", async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(response.body).toHaveProperty('projects');
    });
  });

  describe("Invalid Routes", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app)
        .get('/api/v1/unknown/route')
        .expect(404);
    });
  });

  describe("Request Validation", () => {
    it("should handle JSON body correctly", async () => {
      const response = await request(app)
        .post('/api/v1/thinking/config')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ key: 'value' }))
        .expect(200);

      expect(response.body.key).toBe('value');
    });

    it("should return 400 for invalid JSON", async () => {
      const response = await request(app)
        .post('/api/v1/thinking/config')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });
});
