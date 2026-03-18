// LLM 响应格式诊断测试
import { describe, it, expect, beforeEach } from "vitest";
import { getLLMClient, getApiKey } from "../../src/agents/index.js";
import { createDefaultTools } from "../../src/tools/index.js";

describe("LLM Response Format Diagnostics", () => {
  it("should debug LLM response structure when tool_use", async () => {
    let apiKey = '';
    try {
      apiKey = getApiKey();
    } catch (e) {
      // ignore
    }

    if (!apiKey) {
      console.log("Skipping - no API key found");
      return;
    }

    const client = getLLMClient();
    const tools = createDefaultTools();

    // 获取 read 工具的定义
    const readTool = tools.find(t => t.name === 'read');

    // 直接调用 LLM
    const response = await (client as any).chat({
      model: (client as any).model,
      messages: [{ role: 'user', content: '请读取 package.json 文件' }],
      tools: [{
        name: 'read',
        description: readTool?.description || 'Read file',
        input_schema: readTool?.parameters?.properties || {}
      }]
    });

    console.log("=== LLM Response Structure ===");
    console.log("Full response keys:", Object.keys(response));
    console.log("stop_reason:", response.stop_reason);
    console.log("content:", response.content);
    console.log("content type:", Array.isArray(response.content) ? 'array' : typeof response.content);

    if (Array.isArray(response.content)) {
      console.log("content items:");
      response.content.forEach((item: any, i: number) => {
        console.log(`  [${i}]:`, JSON.stringify(item));
      });
    }

    // 检查可能的 tool_calls 位置
    console.log("\n=== Checking possible tool_calls locations ===");
    console.log("response.tool_calls:", (response as any).tool_calls);
    console.log("response.content[0].tool_calls:", (response.content?.[0] as any)?.tool_calls);
    console.log("response.content[0].type:", (response.content?.[0] as any)?.type);

    // 预期：MiniMax 可能在 content 数组中返回 tool_use 类型的块
    const toolUseBlocks = response.content?.filter((b: any) => b.type === 'tool_use');
    console.log("\ntool_use blocks:", toolUseBlocks);

    expect(true).toBe(true); // 总是通过，只是为了打印信息
  });
});
