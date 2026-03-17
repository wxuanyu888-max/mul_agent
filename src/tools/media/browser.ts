// Browser 工具
import { jsonResult, errorResult } from "../types.js";

export function createBrowserTool() {
  return {
    label: "Browser",
    name: "browser",
    description: "Control web browser",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["navigate", "screenshot", "click", "type", "scroll"] },
        url: { type: "string" },
        selector: { type: "string" },
        text: { type: "string" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: { action: string; url?: string; selector?: string; text?: string }) => {
      try {
        return jsonResult({ action: params.action, url: params.url });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
