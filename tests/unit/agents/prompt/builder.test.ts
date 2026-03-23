/**
 * Prompt Builder 测试 - 验证分层模式
 */
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, PromptMode } from '../../../../src/agents/prompt/builder.js';

describe('Prompt Builder - 分层模式', () => {
  const mockTools = [
    { name: 'read', description: 'Read file content', inputSchema: {} },
    { name: 'write', description: 'Write file content', inputSchema: {} },
  ];

  const baseContext = {
    config: {
      workspaceDir: '/test/workspace',
      promptMode: 'full' as PromptMode,
    },
    tools: mockTools,
    skills: [],
    runtime: {},
  };

  describe('Full 模式', () => {
    it('应该生成完整 prompt', () => {
      const prompt = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'full' } });
      expect(prompt).toContain('You are a personal assistant');
      expect(prompt).toContain('Tooling');
      expect(prompt).toContain('Tool availability');
      expect(prompt).toContain('read');
      expect(prompt).toContain('write');
      expect(prompt.length).toBeGreaterThan(500);
    });
  });

  describe('Minimal 模式', () => {
    it('应该生成精简 prompt', () => {
      const prompt = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'minimal' } });
      expect(prompt).toContain('You are a personal assistant');
      expect(prompt).toContain('Tooling');
      // minimal 模式比 full 短
      expect(prompt.length).toBeLessThan(2000);
    });

    it('不应该包含 skills 部分', () => {
      const prompt = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'minimal' } });
      expect(prompt).not.toContain('## Skills');
    });
  });

  describe('None 模式', () => {
    it('应该生成极简 prompt', () => {
      const prompt = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'none' } });
      const minimal = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'minimal' } });
      expect(prompt).toContain('You are a personal assistant');
      // none 模式应该比 minimal 短
      expect(prompt.length).toBeLessThan(minimal.length);
    });

    it('不应该包含 Tooling 部分', () => {
      const prompt = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'none' } });
      expect(prompt).not.toContain('## Tooling');
    });
  });

  describe('Prompt 长度对比', () => {
    it('none < minimal < full', () => {
      const none = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'none' } });
      const minimal = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'minimal' } });
      const full = buildSystemPrompt({ ...baseContext, config: { ...baseContext.config, promptMode: 'full' } });

      expect(none.length).toBeLessThan(minimal.length);
      expect(minimal.length).toBeLessThan(full.length);
    });
  });
});
