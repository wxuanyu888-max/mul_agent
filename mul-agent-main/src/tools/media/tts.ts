// TTS 工具
import { jsonResult, errorResult } from "../types.js";

export function createTtsTool() {
  return {
    label: "TTS",
    name: "tts",
    description: "Text to speech synthesis",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
        voice: { type: "string" },
      },
      required: ["text"],
    },
    execute: async (_toolCallId: string, params: { text: string; voice?: string }) => {
      try {
        return jsonResult({ text: params.text, voice: params.voice || "default" });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
