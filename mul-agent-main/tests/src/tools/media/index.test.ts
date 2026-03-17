// Media 工具测试
import { describe, it, expect } from "vitest";
import {
  createBrowserTool,
  createCanvasTool,
  createNodesTool,
  createTtsTool,
  createImageTool,
  createPdfTool,
} from "../../../src/tools/media/index.js";

describe("Tools - Media", () => {
  describe("createBrowserTool", () => {
    const browserTool = createBrowserTool();

    it("should have correct metadata", () => {
      expect(browserTool.label).toBe("Browser");
      expect(browserTool.name).toBe("browser");
      expect(browserTool.parameters.required).toContain("action");
    });

    it("should execute action", async () => {
      const result = await browserTool.execute("call-1", { action: "status" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createCanvasTool", () => {
    const canvasTool = createCanvasTool();

    it("should have correct metadata", () => {
      expect(canvasTool.label).toBe("Canvas");
      expect(canvasTool.name).toBe("canvas");
    });

    it("should execute action", async () => {
      const result = await canvasTool.execute("call-1", { action: "present" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createNodesTool", () => {
    const nodesTool = createNodesTool();

    it("should have correct metadata", () => {
      expect(nodesTool.label).toBe("Nodes");
      expect(nodesTool.name).toBe("nodes");
    });

    it("should execute action", async () => {
      const result = await nodesTool.execute("call-1", { action: "list" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createTtsTool", () => {
    const ttsTool = createTtsTool();

    it("should have correct metadata", () => {
      expect(ttsTool.label).toBe("TTS");
      expect(ttsTool.name).toBe("tts");
      expect(ttsTool.parameters.required).toContain("text");
    });

    it("should execute tts", async () => {
      const result = await ttsTool.execute("call-1", { text: "Hello" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createImageTool", () => {
    const imageTool = createImageTool();

    it("should have correct metadata", () => {
      expect(imageTool.label).toBe("Image");
      expect(imageTool.name).toBe("image");
      expect(imageTool.parameters.required).toContain("action");
    });

    it("should execute action", async () => {
      const result = await imageTool.execute("call-1", { action: "analyze", image: "test.jpg" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("createPdfTool", () => {
    const pdfTool = createPdfTool();

    it("should have correct metadata", () => {
      expect(pdfTool.label).toBe("PDF");
      expect(pdfTool.name).toBe("pdf");
      expect(pdfTool.parameters.required).toContain("action");
    });

    it("should execute action", async () => {
      const result = await pdfTool.execute("call-1", { action: "extract", file: "test.pdf" });
      expect(result.error).toBeUndefined();
    });
  });
});
