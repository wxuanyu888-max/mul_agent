// Web Fetch 工具 - 模块化链接处理，保存到工作区
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { jsonResult, errorResult } from "../types.js";

// 工作区路径
const WORKSPACE_DIR = 'storage/runtime/workspace';

// ============ 模块化提取器 ============

/**
 * HTML 内容提取器 - 智能提取有用信息
 */
function extractHtml(html: string, prompt?: string): {
  text: string;
  metadata: Record<string, unknown>;
  structured: Record<string, unknown>;
} {
  // 1. 去除无用标签
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|noscript|embed|object|svg|canvas)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '');

  // 2. 提取元数据
  const metadata: Record<string, unknown> = {};
  const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) metadata.title = titleMatch[1].trim();

  const metaPattern = /<meta[^>]+(name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi;
  let match;
  while ((match = metaPattern.exec(cleanHtml)) !== null) {
    metadata[match[2]] = match[3].trim();
  }

  // 3. 提取结构化数据
  const structured: Record<string, unknown> = {};
  const h1Match = cleanHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) structured.h1 = h1Match[1].trim();

  const h2Matches = cleanHtml.match(/<h2[^>]*>([^<]+)<\/h2>/gi);
  if (h2Matches) structured.h2 = h2Matches.map(h => h.replace(/<[^>]+>/g, '').trim());

  // 链接
  const linkPattern = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]{1,200})<\/a>/gi;
  const links: Array<{ href: string; text: string }> = [];
  while ((match = linkPattern.exec(cleanHtml)) !== null) {
    const text = match[2].trim();
    if (text && text.length > 0) {
      links.push({ href: match[1], text });
    }
  }
  structured.links = links.slice(0, 20);
  structured.linkCount = links.length;

  // 图片
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: Array<{ src: string; alt?: string }> = [];
  while ((match = imgPattern.exec(cleanHtml)) !== null) {
    const src = match[1];
    const altMatch = match[0].match(/alt=["']([^"']*)["']/);
    images.push({ src, alt: altMatch?.[1] });
  }
  structured.images = images.slice(0, 10);

  // 4. 提取纯文本
  let text = cleanHtml
    .replace(/<(p|div|span|li|td|th|article|section|header|footer|nav|main)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  // 根据 prompt 过滤
  if (prompt) {
    const promptLower = prompt.toLowerCase();
    const lines = text.split('\n');
    const relevantLines = lines.filter(line =>
      line.toLowerCase().includes(promptLower) ||
      promptLower.split(/\s+/).some(kw => kw.length > 2 && line.toLowerCase().includes(kw))
    );
    if (relevantLines.length > 0) {
      text = relevantLines.join('\n');
    }
  }

  return { text, metadata, structured };
}

/**
 * JSON 内容提取器
 */
function extractJson(content: string, prompt?: string): {
  text: string;
  metadata: Record<string, unknown>;
  structured: unknown;
} {
  try {
    const parsed = JSON.parse(content);
    let text = content;
    let structured = parsed;

    if (prompt) {
      const keys = prompt.split(/[,.\s]+/).filter(k => k.trim());
      let current: unknown = parsed;
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = (current as Record<string, unknown>)[key];
        } else {
          break;
        }
      }
      if (current !== parsed) {
        structured = current;
        text = JSON.stringify(current, null, 2);
      }
    }

    return { text, metadata: { isJson: true }, structured };
  } catch {
    return { text: content, metadata: { isJson: false, parseError: true }, structured: null };
  }
}

/**
 * 检测内容类型
 */
function detectContentType(contentType: string, url: string): { type: string; category: string; isHtml: boolean; isJson: boolean } {
  const ct = contentType.toLowerCase();
  if (ct.includes('text/html')) return { type: 'html', category: 'webpage', isHtml: true, isJson: false };
  if (ct.includes('application/json') || ct.includes('+json')) return { type: 'json', category: 'api', isHtml: false, isJson: true };
  if (ct.includes('application/xml') || ct.includes('text/xml')) return { type: 'xml', category: 'data', isHtml: false, isJson: false };
  if (ct.includes('application/pdf')) return { type: 'pdf', category: 'document', isHtml: false, isJson: false };
  if (ct.includes('image/')) return { type: 'image', category: 'media', isHtml: false, isJson: false };
  if (ct.includes('text/')) return { type: 'text', category: 'text', isHtml: false, isJson: false };

  if (url.endsWith('.json')) return { type: 'json', category: 'api', isHtml: false, isJson: true };
  if (url.endsWith('.html') || url.endsWith('.htm')) return { type: 'html', category: 'webpage', isHtml: true, isJson: false };

  return { type: 'unknown', category: 'unknown', isHtml: false, isJson: false };
}

/**
 * 生成唯一目录名（按 session 划分）
 */
function generateDirName(url: string, sessionId?: string): string {
  const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  const timestamp = Date.now().toString(36);
  if (sessionId) {
    // 按 session 划分：sessionId/fetch_timestamp_hash
    return `${sessionId}/fetch_${timestamp}_${hash}`;
  }
  // 兼容旧版本
  return `fetch_${timestamp}_${hash}`;
}

// ============ 工具定义 ============

export function createWebFetchTool(sessionId?: string) {
  return {
    label: "Web Fetch",
    name: "web_fetch",
    description: "Fetch content from a URL and save to workspace files. Use when you need to read web pages, extract information from websites, or download online content for later analysis. After fetching, use read tool to view the saved files.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch. Must be a valid HTTP/HTTPS URL" },
        operation: {
          type: "string",
          description: "Operation mode: 'read' (fetch and save content), 'detect' (detect content type without saving), 'headers' (get HTTP headers only)",
          enum: ["read", "detect", "headers"],
          default: "read"
        },
        prompt: { type: "string", description: "Optional hint to guide content extraction. For example, 'extract all headings and links' or 'get only the article body'" },
        saveToFile: {
          type: "boolean",
          description: "Save extracted content to workspace files (default: true). When false, returns content inline instead of saving",
          default: true
        },
        options: {
          type: "object",
          description: "Additional options",
          properties: {
            maxLength: { type: "number", description: "Max text length per file (default: 8000)" },
            includeMetadata: { type: "boolean", description: "Save metadata file (default: true)" },
            includeStructured: { type: "boolean", description: "Save structured data file (default: true)" },
          }
        },
      },
      required: ["url"],
    },
    execute: async (_toolCallId: string, params: {
      url: string;
      operation?: "read" | "detect" | "headers";
      prompt?: string;
      saveToFile?: boolean;
      options?: { maxLength?: number; includeMetadata?: boolean; includeStructured?: boolean };
    }) => {
      try {
        const {
          url,
          operation = "read",
          prompt,
          saveToFile = true,
          options = {}
        } = params;

        const {
          maxLength = 8000,
          includeMetadata = true,
          includeStructured = true,
        } = options;

        // 验证 URL
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          return errorResult(`Invalid URL: ${url}`);
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return errorResult(`Unsupported protocol: ${parsedUrl.protocol}`);
        }

        // HEAD 请求
        if (operation === "headers") {
          const response = await fetch(url, { method: "HEAD" });
          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => { headers[key] = value; });
          return jsonResult({ url, operation: "headers", status: response.status, headers });
        }

        // detect 操作
        if (operation === "detect") {
          const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
          const contentType = response.headers.get('content-type') || '';
          const info = detectContentType(contentType, url);
          return jsonResult({
            url,
            operation: "detect",
            status: response.status,
            contentType,
            type: info.type,
            category: info.category,
            suggestedOperation: info.isHtml || info.isJson ? "read" : "read",
          });
        }

        // 读取内容
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/json,application/xml,text/plain,*/*',
          },
        });

        if (!response.ok) {
          return errorResult(`Fetch failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        const info = detectContentType(contentType, url);
        const content = await response.text();

        let text = content;
        let metadata: Record<string, unknown> = {};
        let structured: Record<string, unknown> = {};

        if (info.isHtml) {
          const extracted = extractHtml(content, prompt);
          text = extracted.text;
          metadata = extracted.metadata;
          structured = extracted.structured;
        } else if (info.isJson) {
          const extracted = extractJson(content, prompt);
          text = extracted.text;
          metadata = extracted.metadata;
          structured = extracted.structured as Record<string, unknown>;
        }

        // 保存到文件
        if (saveToFile) {
          const dirName = generateDirName(url, sessionId);
          const targetDir = path.join(WORKSPACE_DIR, dirName);
          await fs.mkdir(targetDir, { recursive: true });

          const files: Array<{ name: string; path: string; description: string }> = [];

          // 1. _meta.json - 元信息
          const metaInfo = {
            url,
            operation,
            status: response.status,
            contentType,
            type: info.type,
            category: info.category,
            fetchedAt: new Date().toISOString(),
            prompt: prompt || null,
          };
          await fs.writeFile(path.join(targetDir, '_meta.json'), JSON.stringify(metaInfo, null, 2), 'utf-8');
          files.push({ name: '_meta.json', path: `${targetDir}/_meta.json`, description: 'Fetch metadata and info' });

          // 2. text.txt - 纯文本
          const truncated = text.length > maxLength;
          const finalText = truncated ? text.substring(0, maxLength) + '\n\n[truncated...]' : text;
          await fs.writeFile(path.join(targetDir, 'text.txt'), finalText, 'utf-8');
          files.push({
            name: 'text.txt',
            path: `${targetDir}/text.txt`,
            description: truncated ? `Main content (truncated, ${maxLength} chars)` : `Main content (${text.length} chars)`
          });

          // 3. metadata.json - 元数据
          if (includeMetadata && Object.keys(metadata).length > 0) {
            await fs.writeFile(path.join(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
            files.push({ name: 'metadata.json', path: `${targetDir}/metadata.json`, description: 'Page title, meta tags, descriptions' });
          }

          // 4. structured.json - 结构化数据
          if (includeStructured && Object.keys(structured).length > 0) {
            await fs.writeFile(path.join(targetDir, 'structured.json'), JSON.stringify(structured, null, 2), 'utf-8');
            files.push({ name: 'structured.json', path: `${targetDir}/structured.json`, description: 'Headings, links, images (structured)' });
          }

          // 5. original.html - 原始 HTML（可选，仅对 HTML 有效）
          if (info.isHtml && content.length < 500000) {
            await fs.writeFile(path.join(targetDir, 'original.html'), content, 'utf-8');
            files.push({ name: 'original.html', path: `${targetDir}/original.html`, description: 'Original HTML (if needed)' });
          }

          // 返回文件列表
          // 生成文件列表消息
          const fileListMsg = files.map(f => `- ${f.name}: ${f.path}`).join('\n');
          const message = `Saved to session workspace:\n${fileListMsg}\n\nUse "read" tool to read files by path.`;

          return jsonResult({
            success: true,
            url,
            operation,
            type: info.type,
            category: info.category,
            workspace: targetDir,
            files,
            message
          });
        }

        // 不保存到文件（传统方式）
        const truncated = text.length > maxLength;
        const finalText = truncated ? text.substring(0, maxLength) + '...' : text;

        const result: Record<string, unknown> = {
          url,
          operation,
          status: response.status,
          contentType,
          type: info.type,
          category: info.category,
          text: finalText,
        };

        if (truncated) result.truncated = true;
        if (includeMetadata && Object.keys(metadata).length > 0) result.metadata = metadata;
        if (includeStructured && Object.keys(structured).length > 0) result.structured = structured;

        return jsonResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return errorResult(`Fetch failed: ${message}`);
      }
    },
  };
}
