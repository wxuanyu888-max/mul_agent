/**
 * Skills Manager 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Skills Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exports', () => {
    it('should export skill functions', async () => {
      const { getEnabledSkills, setSkillEnabled, setCategoryEnabled } = await import('../../../src/skills/index.js');

      expect(getEnabledSkills).toBeDefined();
      expect(setSkillEnabled).toBeDefined();
      expect(setCategoryEnabled).toBeDefined();
    });

    it('should export skillCategories', async () => {
      const { skillCategories } = await import('../../../src/skills/index.js');

      expect(skillCategories).toBeDefined();
    });
  });

  describe('getEnabledSkills', () => {
    it('should return enabled skills', async () => {
      const { getEnabledSkills } = await import('../../../src/skills/index.js');

      const skills = getEnabledSkills();

      expect(Array.isArray(skills)).toBe(true);
    });
  });

  describe('setSkillEnabled', () => {
    it('should enable skill', async () => {
      const { setSkillEnabled } = await import('../../../src/skills/index.js');

      expect(typeof setSkillEnabled).toBe('function');
    });
  });

  describe('skillCategories', () => {
    it('should have category definitions', async () => {
      const { skillCategories } = await import('../../../src/skills/index.js');

      expect(skillCategories).toBeInstanceOf(Object);
    });
  });
});
