/**
 * Express API Server
 *
 * Provides REST API endpoints for the frontend.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Import routers
import { createInfoRouter } from './routes/info.js';
import { createAgentsRouter } from './routes/agents.js';
import { createChatRouter } from './routes/chat.js';
import { createMemoryRouter } from './routes/memory.js';
import { createLogsRouter } from './routes/logs.js';
import { createProjectsRouter } from './routes/projects.js';
import { createTokenRouter } from './routes/token.js';
import { createIntegrationsRouter } from './routes/integrations.js';
import { createTasksRouter } from './routes/tasks.js';

const app: ReturnType<typeof express> = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Register routers
app.use('/api/v1', createInfoRouter());
app.use('/api/v1', createAgentsRouter());
app.use('/api/v1', createChatRouter());
app.use('/api/v1', createMemoryRouter());
app.use('/api/v1', createLogsRouter());
app.use('/api/v1', createProjectsRouter());
app.use('/api/v1', createTokenRouter());
app.use('/api/v1', createIntegrationsRouter());
app.use('/api/v1', createTasksRouter());

// Legacy route for /api/llm-config (without v1 prefix)
const legacyGlobalConfig = { url: '', provider: 'openai', model: 'gpt-4', has_key: false };
app.get('/api/llm-config', (req, res) => {
  res.json(legacyGlobalConfig);
});
app.post('/api/llm-config', (req, res) => {
  const { url, provider, model, key } = req.body;
  legacyGlobalConfig.url = url || '';
  legacyGlobalConfig.provider = provider || 'openai';
  legacyGlobalConfig.model = model || 'gpt-4';
  if (key) legacyGlobalConfig.has_key = true;
  res.json({ status: 'success', ...legacyGlobalConfig });
});
app.delete('/api/llm-config', (req, res) => {
  legacyGlobalConfig.url = '';
  legacyGlobalConfig.provider = 'openai';
  legacyGlobalConfig.model = 'gpt-4';
  legacyGlobalConfig.has_key = false;
  res.json({ status: 'success' });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});

export default app;
