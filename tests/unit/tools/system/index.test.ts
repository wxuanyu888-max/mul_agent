// System 工具测试
import { describe, it, expect } from "vitest";
import {
  createCronTool,
  createGatewayTool,
  createSubagentsTool,
  createAgentsListTool,
} from "../../../../src/tools/system/index.js";

describe("Tools - System", () => {
  describe("createCronTool", () => {
    const cronTool = createCronTool();

    it("should have correct metadata", () => {
      expect(cronTool.label).toBe("Cron");
      expect(cronTool.name).toBe("cron");
      expect(cronTool.parameters.required).toContain("action");
    });

    it("should support list action", async () => {
      const result = await cronTool.execute("call-1", { action: "list" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createGatewayTool", () => {
    const gatewayTool = createGatewayTool();

    it("should have correct metadata", () => {
      expect(gatewayTool.label).toBe("Gateway");
      expect(gatewayTool.name).toBe("gateway");
      expect(gatewayTool.parameters.required).toContain("action");
    });

    it("should support status action", async () => {
      const result = await gatewayTool.execute("call-1", { action: "status" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createSubagentsTool", () => {
    const subagentsTool = createSubagentsTool();

    it("should have correct metadata", () => {
      expect(subagentsTool.label).toBe("Subagents");
      expect(subagentsTool.name).toBe("subagents");
      expect(subagentsTool.parameters.required).toContain("action");
    });

    it("should support list action", async () => {
      const result = await subagentsTool.execute("call-1", { action: "list" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createAgentsListTool", () => {
    const agentsListTool = createAgentsListTool();

    it("should have correct metadata", () => {
      expect(agentsListTool.label).toBe("Agents List");
      expect(agentsListTool.name).toBe("agents_list");
      expect(agentsListTool.description).toBeDefined();
    });

    it("should execute list", async () => {
      const result = await agentsListTool.execute("call-1", {});
      expect(result.error).toBeUndefined();
    });
  });
});
