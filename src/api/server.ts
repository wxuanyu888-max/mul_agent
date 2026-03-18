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
