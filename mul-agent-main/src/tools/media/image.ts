// Image 工具
import { jsonResult, errorResult } from "../types.js";

export function createImageTool() {
  return {
    label: "Image",
    name: "image",
    description: "Analyze an image with the configured image model",
    parameters: {
      type: "object",
      properties: {
        image: { type: "string" },
        prompt: { type: "string" },
      },
      required: ["image"],
    },
    execute: async (_toolCallId: string, params: { image: string; prompt?: string }) => {
      try {
        return jsonResult({ image: params.image, prompt: params.prompt || "Describe this image" });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
