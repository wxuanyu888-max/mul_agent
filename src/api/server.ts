/**
 * Express API Server
 *
 * Provides REST API endpoints for the frontend.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';

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
import { createFilesRouter } from './routes/files.js';
import { createVoiceRouter } from './routes/voice.js';
import { createCronRouter } from './routes/cron.js';

// Import additional feature routers
import { createCheckpointTimeTravelRouter } from './routes/checkpoint-time-travel.js';
import { createDebugRouter } from './routes/debug.js';
import { createPromptVersionsRouter } from './routes/prompt-versions.js';
import { createHumanInLoopRouter } from './routes/human-in-loop.js';
// Use the more complete memory router
import { createMemoryRouter as createFullMemoryRouter } from '../memory/routes.js';

// Initialize plugins
import { initializePlugins, type PluginRegistry } from '../plugins/index.js';

// Cron 通知事件发射器
import { EventEmitter } from 'events';
const cronNotificationEmitter = new EventEmitter();
export { cronNotificationEmitter };

let pluginRegistry: PluginRegistry;
const app: ReturnType<typeof express> = express();
const PORT = process.env.PORT || 8080;

async function initializeApp() {
  // Initialize plugins
  const pluginsDir = process.env.PLUGINS_DIR || 'plugins';
  pluginRegistry = await initializePlugins(
    { /* config */ },
    pluginsDir
  );

  console.log(`[Plugins] Loaded: ${pluginRegistry.providers.size} providers, ${pluginRegistry.channels.size} channels, ${pluginRegistry.tools.size} tools`);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Multer configuration for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('File type not allowed'));
      }
    }
  });
  // Make upload middleware available to routes
  (app as any).upload = upload;

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

  // File upload router - use multer middleware
  app.use('/api/v1/files', createFilesRouter());

  // Register additional feature routers
  app.use('/api/v1/debug', createDebugRouter());
  app.use('/api/v1/checkpoints', createCheckpointTimeTravelRouter());
  app.use('/api/v1/prompts', createPromptVersionsRouter());
  app.use('/api/v1/human-in-loop', createHumanInLoopRouter());
  app.use('/api/v1/memory/full', createFullMemoryRouter());
  app.use('/api/v1/voice', createVoiceRouter());
  app.use('/api/v1', createCronRouter());

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
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
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
}

// Start the server
initializeApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
