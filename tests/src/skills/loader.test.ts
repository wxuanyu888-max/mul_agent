// Skills Loader 测试
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  parseFrontmatter,
  resolveOpenClawMetadata,
  resolveSkillInvocationPolicy,
  createSkillFromContent,
  findSkillByKey,
  getUserInvocableSkills,
} from "../../../src/skills/loader.js";

describe("Skills Loader", () => {
  describe("parseFrontmatter", () => {
    it("should parse frontmatter from content", () => {
      const content = `---
name: test-skill
description: A test skill
---
# Skill Content`;

      const result = parseFrontmatter(content);

      expect(result.data.name).toBe("test-skill");
      expect(result.data.description).toBe("A test skill");
      expect(result.content).toBe("# Skill Content");
    });

    it("should handle content without frontmatter", () => {
      const content = "# Just content";

      const result = parseFrontmatter(content);

      expect(result.data).toEqual({});
      expect(result.content).toBe("# Just content");
    });

    it("should handle empty frontmatter", () => {
      const content = `---
---
# Content`;

      const result = parseFrontmatter(content);

      expect(result.data).toEqual({});
      // Note: empty frontmatter leaves trailing newlines
      expect(result.content).toContain("# Content");
    });

    it("should parse boolean values", () => {
      const content = `---
enabled: true
disabled: false
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.data.enabled).toBe(true);
      expect(result.data.disabled).toBe(false);
    });

    it("should parse quoted strings", () => {
      const content = `---
name: "Test Skill"
description: 'Single quotes'
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.data.name).toBe("Test Skill");
      expect(result.data.description).toBe("Single quotes");
    });

    it("should handle simple values", () => {
      const content = `---
name: test
description: A simple description
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.data.name).toBe("test");
      expect(result.data.description).toBe("A simple description");
    });
  });

  describe("resolveOpenClawMetadata", () => {
    it("should extract boolean metadata", () => {
      const frontmatter = {
        data: { always: true, emoji: "🚀", homepage: "https://example.com" },
        content: "",
      };

      const metadata = resolveOpenClawMetadata(frontmatter);

      expect(metadata?.always).toBe(true);
      expect(metadata?.emoji).toBe("🚀");
      expect(metadata?.homepage).toBe("https://example.com");
    });

    it("should extract skillKey", () => {
      const frontmatter = {
        data: { skillKey: "my-skill-key" },
        content: "",
      };

      const metadata = resolveOpenClawMetadata(frontmatter);

      expect(metadata?.skillKey).toBe("my-skill-key");
    });

    it("should extract primaryEnv", () => {
      const frontmatter = {
        data: { primaryEnv: "NODE_ENV" },
        content: "",
      };

      const metadata = resolveOpenClawMetadata(frontmatter);

      expect(metadata?.primaryEnv).toBe("NODE_ENV");
    });

    it("should handle os array", () => {
      const frontmatter = {
        data: { os: ["darwin", "linux"] },
        content: "",
      };

      const metadata = resolveOpenClawMetadata(frontmatter);

      expect(metadata?.os).toEqual(["darwin", "linux"]);
    });

    it("should handle os single value", () => {
      const frontmatter = {
        data: { os: "darwin" },
        content: "",
      };

      const metadata = resolveOpenClawMetadata(frontmatter);

      expect(metadata?.os).toEqual(["darwin"]);
    });

    it("should return undefined for empty data", () => {
      const frontmatter = { data: {}, content: "" };

      const metadata = resolveOpenClawMetadata(frontmatter);

      expect(metadata).toBeUndefined();
    });
  });

  describe("resolveSkillInvocationPolicy", () => {
    it("should default to userInvocable true", () => {
      const frontmatter = { data: {}, content: "" };

      const policy = resolveSkillInvocationPolicy(frontmatter);

      expect(policy.userInvocable).toBe(true);
    });

    it("should allow disabling userInvocable", () => {
      const frontmatter = { data: { "user-invocable": false }, content: "" };

      const policy = resolveSkillInvocationPolicy(frontmatter);

      expect(policy.userInvocable).toBe(false);
    });

    it("should handle disableModelInvocation", () => {
      const frontmatter = { data: { "disable-model-invocation": true }, content: "" };

      const policy = resolveSkillInvocationPolicy(frontmatter);

      expect(policy.disableModelInvocation).toBe(true);
    });
  });

  describe("createSkillFromContent", () => {
    it("should create skill from markdown content", () => {
      const content = `---
name: my-skill
description: A test skill
---
# My Skill Content`;

      const skill = createSkillFromContent("/path/to/my-skill.md", content);

      expect(skill.name).toBe("my-skill");
      expect(skill.description).toBe("A test skill");
      expect(skill.content).toBe("# My Skill Content");
      expect(skill.frontmatter.name).toBe("my-skill");
    });

    it("should use filename as name when not in frontmatter", () => {
      const content = `# Just content`;

      const skill = createSkillFromContent("/path/to/cool-skill.md", content);

      expect(skill.name).toBe("cool-skill");
    });

    it("should handle empty frontmatter", () => {
      const content = `---
---
# Content`;

      const skill = createSkillFromContent("/path/to/skill.md", content);

      expect(skill.frontmatter).toEqual({});
      expect(skill.content).toContain("# Content");
    });
  });

  describe("findSkillByKey", () => {
    it("should find skill by name", () => {
      const skills = [
        {
          skill: { name: "skill-one", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: {},
          invocation: {},
        },
        {
          skill: { name: "skill-two", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: {},
          invocation: {},
        },
      ];

      const found = findSkillByKey(skills, "skill-one");

      expect(found?.skill.name).toBe("skill-one");
    });

    it("should find skill by skillKey", () => {
      const skills = [
        {
          skill: { name: "my-skill", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: { skillKey: "custom-key" },
          invocation: {},
        },
      ];

      const found = findSkillByKey(skills, "custom-key");

      expect(found?.skill.name).toBe("my-skill");
    });

    it("should be case insensitive", () => {
      const skills = [
        {
          skill: { name: "MySkill", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: {},
          invocation: {},
        },
      ];

      const found = findSkillByKey(skills, "myskilL");

      expect(found?.skill.name).toBe("MySkill");
    });

    it("should return undefined for non-existent skill", () => {
      const skills = [
        {
          skill: { name: "skill-one", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: {},
          invocation: {},
        },
      ];

      const found = findSkillByKey(skills, "non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getUserInvocableSkills", () => {
    it("should return all skills with default invocation", () => {
      const skills = [
        {
          skill: { name: "skill-one", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: {},
          invocation: { userInvocable: true },
        },
        {
          skill: { name: "skill-two", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: {},
          invocation: { userInvocable: false },
        },
      ];

      const invocable = getUserInvocableSkills(skills);

      expect(invocable.length).toBe(1);
      expect(invocable[0].skill.name).toBe("skill-one");
    });

    it("should include skills with undefined invocation", () => {
      const skills = [
        {
          skill: { name: "skill-one", description: "", content: "", frontmatter: {} },
          frontmatter: { data: {} },
          metadata: {},
          invocation: {},
        },
      ];

      const invocable = getUserInvocableSkills(skills);

      expect(invocable.length).toBe(1);
    });
  });
});
