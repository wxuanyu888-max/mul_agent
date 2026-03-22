/**
 * Skills Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { Skill, SkillEntry, SkillFrontmatter, SkillCommand, SkillTool } from '../../../src/skills/types.js';

describe('Skills Types', () => {
  describe('Skill', () => {
    it('should create skill with required fields', () => {
      const skill: Skill = {
        key: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
      };

      expect(skill.key).toBe('test-skill');
      expect(skill.name).toBe('Test Skill');
    });

    it('should accept optional fields', () => {
      const skill: Skill = {
        key: 'test',
        name: 'Test',
        description: 'Description',
        category: 'testing',
        commands: [],
        tools: [],
        triggers: ['/test'],
      };

      expect(skill.category).toBe('testing');
      expect(skill.triggers).toContain('/test');
    });
  });

  describe('SkillEntry', () => {
    it('should have required fields', () => {
      const entry: SkillEntry = {
        key: 'my-skill',
        name: 'My Skill',
        path: '/skills/my-skill',
        frontmatter: {
          name: 'My Skill',
          description: 'Description',
        },
      };

      expect(entry.key).toBe('my-skill');
      expect(entry.path).toBe('/skills/my-skill');
    });
  });

  describe('SkillFrontmatter', () => {
    it('should parse frontmatter', () => {
      const fm: SkillFrontmatter = {
        name: 'Test Skill',
        description: 'A test skill',
        category: 'testing',
        triggers: ['/test', '/t'],
      };

      expect(fm.name).toBe('Test Skill');
      expect(fm.category).toBe('testing');
    });

    it('should accept optional fields', () => {
      const fm: SkillFrontmatter = {
        name: 'Test',
        description: 'Test skill',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test', 'demo'],
      };

      expect(fm.version).toBe('1.0.0');
      expect(fm.tags).toContain('test');
    });
  });

  describe('SkillCommand', () => {
    it('should define command', () => {
      const cmd: SkillCommand = {
        name: 'hello',
        description: 'Say hello',
        trigger: '/hello',
        handler: async () => 'Hello!',
      };

      expect(cmd.name).toBe('hello');
      expect(cmd.trigger).toBe('/hello');
    });
  });

  describe('SkillTool', () => {
    it('should define tool', () => {
      const tool: SkillTool = {
        name: 'calculate',
        description: 'Calculate something',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' },
          },
          required: ['expression'],
        },
        handler: async (params) => ({ content: 'result', error: null }),
      };

      expect(tool.name).toBe('calculate');
      expect(tool.parameters.required).toContain('expression');
    });
  });
});
