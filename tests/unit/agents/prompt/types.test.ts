/**
 * Prompt Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { PromptBuilderConfig, ToolInfo, SkillInfo } from '../../../src/agents/prompt/types.js';

describe('Prompt Types', () => {
  describe('PromptBuilderConfig', () => {
    it('should create config with required fields', () => {
      const config: PromptBuilderConfig = {
        workspaceDir: '/workspace',
      };

      expect(config.workspaceDir).toBe('/workspace');
    });

    it('should accept all prompt modes', () => {
      const modes: PromptBuilderConfig['promptMode'][] = ['full', 'minimal', 'none'];

      modes.forEach(mode => {
        const config: PromptBuilderConfig = {
          workspaceDir: '/ws',
          promptMode: mode,
        };
        expect(config.promptMode).toBe(mode);
      });
    });

    it('should accept optional fields', () => {
      const config: PromptBuilderConfig = {
        workspaceDir: '/ws',
        sessionId: 'session-1',
        extraSystemPrompt: 'Be helpful',
        userTimezone: 'Asia/Shanghai',
        docsPath: './docs',
        ownerInfo: 'Test User',
        currentTime: '2024-01-01',
        docsUrl: 'https://docs.example.com',
        voiceConfig: 'default',
        generatedFiles: [
          { path: '/ws/file.txt', name: 'file.txt', timestamp: 1000 },
        ],
        skillDescriptions: {
          'skill-1': 'Description 1',
        },
      };

      expect(config.sessionId).toBe('session-1');
      expect(config.generatedFiles).toHaveLength(1);
    });
  });

  describe('ToolInfo', () => {
    it('should define tool', () => {
      const tool: ToolInfo = {
        name: 'read',
        description: 'Read file',
        inputSchema: { type: 'object', properties: {} },
      };

      expect(tool.name).toBe('read');
    });
  });

  describe('SkillInfo', () => {
    it('should define skill', () => {
      const skill: SkillInfo = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'A test skill',
      };

      expect(skill.id).toBe('skill-1');
    });

    it('should track loaded state', () => {
      const skill: SkillInfo = {
        id: 'skill-1',
        name: 'Test',
        description: 'Test',
        content: '# Skill Content',
        isLoaded: true,
      };

      expect(skill.isLoaded).toBe(true);
    });
  });
});
