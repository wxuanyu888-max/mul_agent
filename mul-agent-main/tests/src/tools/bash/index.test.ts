// Bash 工具测试
import { describe, it, expect } from "vitest";
import { createExecTool, createProcessTool } from "../../../src/tools/bash/index.js";

describe("Tools - Bash", () => {
  describe("createExecTool", () => {
    const execTool = createExecTool();

    it("should have correct metadata", () => {
      expect(execTool.label).toBe("Exec");
      expect(execTool.name).toBe("exec");
      expect(execTool.description).toBeDefined();
      expect(execTool.parameters.type).toBe("object");
      expect(execTool.parameters.required).toContain("command");
    });

    it("should have optional parameters", () => {
      expect(execTool.parameters.properties.timeout).toBeDefined();
      expect(execTool.parameters.properties.cwd).toBeDefined();
      expect(execTool.parameters.properties.env).toBeDefined();
      expect(execTool.parameters.properties.shell).toBeDefined();
    });

    it("should execute simple command", async () => {
      const result = await execTool.execute("call-1", { command: "echo 'hello'" });

      expect(result.error).toBeUndefined();
      expect(result.content).toContain("hello");
    });

    it("should return error for invalid command", async () => {
      const result = await execTool.execute("call-1", { command: "exit 1" });

      // exec 工具即使命令失败也会返回结果，通过 returnCode 判断
      expect(result.content).toContain("returnCode");
    });

    it("should support timeout parameter", async () => {
      // 使用短超时测试
      const result = await execTool.execute("call-1", {
        command: "sleep 1",
        timeout: 100,
      });

      expect(result.content).toContain("timedOut");
    });

    it("should support cwd parameter", async () => {
      const result = await execTool.execute("call-1", {
        command: "pwd",
        cwd: "/tmp",
      });

      expect(result.content).toContain("/tmp");
    });
  });

  describe("createProcessTool", () => {
    const processTool = createProcessTool();

    it("should have correct metadata", () => {
      expect(processTool.label).toBe("Process");
      expect(processTool.name).toBe("process");
      expect(processTool.description).toBeDefined();
      expect(processTool.parameters.type).toBe("object");
    });

    it("should have action parameter", () => {
      expect(processTool.parameters.properties.action).toBeDefined();
    });
  });
});
