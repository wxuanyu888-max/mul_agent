// PDF 工具
import { jsonResult, errorResult } from "../types.js";

export function createPdfTool() {
  return {
    label: "PDF",
    name: "pdf",
    description: "Process and extract content from PDF files",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["extract", "summarize"] },
        source: { type: "string" },
        prompt: { type: "string" },
      },
      required: ["action", "source"],
    },
    execute: async (_toolCallId: string, params: { action: string; source: string; prompt?: string }) => {
      try {
        return jsonResult({ action: params.action, source: params.source });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
