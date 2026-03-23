/**
 * Browser 工具单元测试
 *
 * 使用 mock 测试浏览器 MCP 工具的功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrowserMcpTool } from '../../../../src/tools/browser/index.js';

// Mock MCP 客户端
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        { name: 'list_pages', description: 'List open pages' },
        { name: 'new_page', description: 'Open new page' },
        { name: 'navigate_page', description: 'Navigate to URL' },
        { name: 'take_screenshot', description: 'Take screenshot' },
      ],
    }),
    callTool: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({})),
}));

describe('Browser 工具', () => {
  let browserTool: ReturnType<typeof createBrowserMcpTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    browserTool = createBrowserMcpTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('工具定义', () => {
    it('应该正确创建 browser_mcp 工具', () => {
      expect(browserTool.name).toBe('browser_mcp');
      expect(browserTool.label).toBe('Browser MCP');
      expect(browserTool.description).toContain('browser');
    });

    it('应该定义正确的参数模式', () => {
      expect(browserTool.parameters.type).toBe('object');
      expect(browserTool.parameters.properties.action).toBeDefined();
      expect(browserTool.parameters.properties.action.enum).toContain('list');
      expect(browserTool.parameters.properties.action.enum).toContain('navigate');
      expect(browserTool.parameters.properties.action.enum).toContain('screenshot');
    });
  });

  describe('list 动作', () => {
    it('应该能执行 list_pages 动作', async () => {
      const result = await browserTool.execute('test-call-id', {
        action: 'list',
      });

      expect(result.content).toBeDefined();
    });
  });

  describe('参数验证', () => {
    it('new_page 动作需要 url 参数', async () => {
      const result = await browserTool.execute('test-call-id', {
        action: 'new_page',
      });

      expect(result.error).toBeDefined();
    });

    it('navigate 动作需要 url 参数', async () => {
      const result = await browserTool.execute('test-call-id', {
        action: 'navigate',
      });

      expect(result.error).toBeDefined();
    });

    it('click 动作需要 uid 参数', async () => {
      const result = await browserTool.execute('test-call-id', {
        action: 'click',
      });

      expect(result.error).toBeDefined();
    });

    it('fill 动作需要 uid 和 value 参数', async () => {
      const result = await browserTool.execute('test-call-id', {
        action: 'fill',
      });

      expect(result.error).toBeDefined();
    });

    it('close_page 动作需要 pageId 参数', async () => {
      const result = await browserTool.execute('test-call-id', {
        action: 'close_page',
      });

      expect(result.error).toBeDefined();
    });

    it('未知动作应该返回错误', async () => {
      const result = await browserTool.execute('test-call-id', {
        action: 'unknown_action',
      } as any);

      expect(result.error).toContain('Unknown action');
    });
  });
});
