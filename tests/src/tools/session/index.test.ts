// Session 工具测试
import { describe, it, expect } from "vitest";
import {
  createSessionsListTool,
  createSessionsHistoryTool,
  createSessionsSendTool,
  createSessionsSpawnTool,
  createSessionStatusTool,
} from "../../../src/tools/session/index.js";

describe("Tools - Session", () => {
  describe("createSessionsListTool", () => {
    const listTool = createSessionsListTool();

    it("should have correct metadata", () => {
      expect(listTool.label).toBe("Sessions List");
      expect(listTool.name).toBe("sessions_list");
      expect(listTool.description).toBeDefined();
    });

    it("should execute list", async () => {
      const result = await listTool.execute("call-1", {});

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("sessions");
    });
  });

  describe("createSessionsHistoryTool", () => {
    const historyTool = createSessionsHistoryTool();

    it("should have correct metadata", () => {
      expect(historyTool.label).toBe("Sessions History");
      expect(historyTool.name).toBe("sessions_history");
      expect(historyTool.parameters.required).toContain("sessionId");
    });

    it("should have optional limit parameter", () => {
      expect(historyTool.parameters.properties.limit).toBeDefined();
    });

    it("should execute history", async () => {
      const result = await historyTool.execute("call-1", { sessionId: "test-session" });

      expect(result.error).toBeUndefined();
    });
  });

  describe("createSessionsSendTool", () => {
    const sendTool = createSessionsSendTool();

    it("should have correct metadata", () => {
      expect(sendTool.label).toBe("Sessions Send");
      expect(sendTool.name).toBe("sessions_send");
      expect(sendTool.parameters.required).toContain("sessionId");
      expect(sendTool.parameters.required).toContain("message");
    });

    it("should execute send", async () => {
      const result = await sendTool.execute("call-1", {
        sessionId: "test-session",
        message: "Hello",
      });

      expect(result.error).toBeUndefined();
    });
  });

  describe("createSessionsSpawnTool", () => {
    const spawnTool = createSessionsSpawnTool();

    it("should have correct metadata", () => {
      expect(spawnTool.label).toBe("Sessions Spawn");
      expect(spawnTool.name).toBe("sessions_spawn");
      expect(spawnTool.parameters.required).toContain("prompt");
    });

    it("should have optional model parameter", () => {
      expect(spawnTool.parameters.properties.model).toBeDefined();
    });

    it("should execute spawn", async () => {
      const result = await spawnTool.execute("call-1", { prompt: "New agent" });

      expect(result.error).toBeUndefined();
    });
  });

  describe("createSessionStatusTool", () => {
    const statusTool = createSessionStatusTool();

    it("should have correct metadata", () => {
      expect(statusTool.label).toBe("Session Status");
      expect(statusTool.name).toBe("session_status");
      expect(statusTool.description).toBeDefined();
    });

    it("should execute status", async () => {
      const result = await statusTool.execute("call-1", {});

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("status");
    });
  });
});
