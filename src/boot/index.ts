/**
 * Boot Mechanism
 *
 * Executes tasks on startup based on BOOT.md
 * Based on OpenClaw's boot system
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

export const BOOT_FILENAME = 'BOOT.md';

export interface BootResult {
  status: 'skipped' | 'ran' | 'failed';
  reason?: string;
  commands?: string[];
  errors?: string[];
}

export interface BootCommand {
  action: 'message' | 'run' | 'task';
  target?: string;
  content?: string;
  command?: string;
}

export interface BootOptions {
  workspaceDir?: string;
  onMessage?: (target: string, content: string) => Promise<void>;
  onRun?: (command: string) => Promise<void>;
  onTask?: (task: string) => Promise<void>;
}

/**
 * Load BOOT.md file
 */
export async function loadBootFile(
  workspaceDir: string
): Promise<{ content?: string; status: 'ok' | 'missing' | 'empty' }> {
  const bootPath = join(workspaceDir, BOOT_FILENAME);

  try {
    const content = await readFile(bootPath, 'utf-8');
    const trimmed = content.trim();

    if (!trimmed) {
      return { status: 'empty' };
    }

    return { status: 'ok', content: trimmed };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { status: 'missing' };
    }
    throw error;
  }
}

/**
 * Parse BOOT.md content into commands
 */
export function parseBootContent(content: string): BootCommand[] {
  const commands: BootCommand[] = [];
  const lines = content.split('\n');

  let currentAction: BootCommand['action'] | null = null;
  let currentTarget = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check for action headers
    if (trimmed.startsWith('## ')) {
      // Save previous command
      if (currentAction && currentTarget) {
        commands.push({
          action: currentAction,
          target: currentTarget,
          content: currentContent.join('\n').trim(),
        });
      }

      // Parse new action
      const header = trimmed.slice(3).toLowerCase();
      if (header === 'message' || header === 'run' || header === 'task') {
        currentAction = header;
        currentTarget = '';
        currentContent = [];
      }
      continue;
    }

    // Parse target (after action header)
    if (trimmed.startsWith('Target:') && currentAction) {
      currentTarget = trimmed.slice(7).trim();
      continue;
    }

    // Collect content
    if (currentAction) {
      currentContent.push(line);
    }
  }

  // Save last command
  if (currentAction && currentTarget) {
    commands.push({
      action: currentAction,
      target: currentTarget,
      content: currentContent.join('\n').trim(),
    });
  }

  return commands;
}

/**
 * Build boot prompt for agent
 */
export function buildBootPrompt(content: string): string {
  return [
    'You are running a boot check. Follow BOOT.md instructions exactly.',
    '',
    'BOOT.md:',
    content,
    '',
    'Execute the commands listed in BOOT.md.',
    'After completing, respond with DONE.',
  ].join('\n');
}

/**
 * Execute boot commands
 */
export async function executeBoot(
  commands: BootCommand[],
  options: BootOptions
): Promise<BootResult> {
  const errors: string[] = [];

  for (const cmd of commands) {
    try {
      switch (cmd.action) {
        case 'message':
          if (options.onMessage && cmd.target && cmd.content) {
            await options.onMessage(cmd.target, cmd.content);
          }
          break;

        case 'run':
          if (options.onRun && cmd.command) {
            await options.onRun(cmd.command);
          }
          break;

        case 'task':
          if (options.onTask && cmd.target) {
            await options.onTask(cmd.target);
          }
          break;
      }
    } catch (error) {
      errors.push(`Command failed: ${cmd.action} ${cmd.target || ''} - ${error}`);
    }
  }

  if (errors.length > 0) {
    return {
      status: 'failed',
      reason: errors.join('\n'),
      commands: commands.map(c => `${c.action}: ${c.target || c.command}`),
      errors,
    };
  }

  return {
    status: 'ran',
    commands: commands.map(c => `${c.action}: ${c.target || c.command}`),
  };
}

/**
 * Run boot sequence
 */
export async function runBoot(
  workspaceDir: string,
  options: BootOptions
): Promise<BootResult> {
  const { content, status } = await loadBootFile(workspaceDir);

  if (status === 'missing' || status === 'empty') {
    return { status: 'skipped', reason: status };
  }

  if (!content) {
    return { status: 'skipped', reason: 'empty content' };
  }

  const commands = parseBootContent(content);

  if (commands.length === 0) {
    return { status: 'skipped', reason: 'no commands' };
  }

  return executeBoot(commands, options);
}

/**
 * Check if boot file exists
 */
export async function hasBootFile(workspaceDir: string): Promise<boolean> {
  const result = await loadBootFile(workspaceDir);
  return result.status === 'ok';
}
