// 文件读取工具
import fs from 'node:fs/promises';
import path from 'node:path';
import { errorResult, jsonResult } from '../types.js';

export interface ReadFileParams {
  path: string;
  from?: number;    // 起始行
  lines?: number;   // 读取行数
  pages?: string;   // PDF 页码，如 "1-3" 或 "1,2,5"
}

/**
 * 创建文件读取工具
 */
export function createReadTool() {
  return {
    label: 'Read',
    name: 'read',
    description: 'Read the contents of a file. Use when you need to view or analyze file content. Supports text files (with line range), PDF files (with page range), and images (returns base64).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file to read' },
        from: { type: 'number', description: 'Line number to start reading from (1-based, for text files only)', default: 1 },
        lines: { type: 'number', description: 'Number of lines to read (for text files, default: 100)', default: 100 },
        pages: { type: 'string', description: 'Page range for PDF files. Examples: "1-3" for pages 1 to 3, "1,2,5" for specific pages, "all" for entire PDF (default: "all")', default: 'all' },
      },
      required: ['path'],
    },
    execute: async (_toolCallId: string, params: ReadFileParams) => {
      try {
        const { path: filePath, from = 1, lines = 100, pages = 'all' } = params;

        const ext = path.extname(filePath).toLowerCase();

        // 处理 PDF 文件
        if (ext === '.pdf') {
          return await readPdfFile(filePath, pages);
        }

        // 处理图片文件
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
          return await readImageFile(filePath);
        }

        // 处理普通文本文件
        return await readTextFile(filePath, from, lines);
      } catch (error) {
        return errorResult(`Failed to read file: ${error}`);
      }
    },
  };
}

// 读取 PDF 文件
async function readPdfFile(filePath: string, pages: string): Promise<ReturnType<typeof jsonResult>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = await import('pdf-parse') as any;
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse.default(dataBuffer);

    let content: string;
    if (pages === 'all') {
      content = data.text || '';
    } else {
      // 解析页码范围，如 "1-3" 或 "1,2,5"
      const pageNumbers = parsePageRange(pages, data.numpages);
      if (pageNumbers.length === 0) {
        return errorResult(`Invalid page range: ${pages}`);
      }
      // 简单的分页实现 - 返回指定页的内容
      const allPages = data.text.split('\n\n');
      content = pageNumbers.map(p => allPages[p - 1] || '').join('\n\n');
    }

    return jsonResult({
      type: 'pdf',
      content,
      pages: data.numpages,
      requestedPages: pages,
      path: filePath,
    });
  } catch (error) {
    return errorResult(`Failed to read PDF: ${error}`);
  }
}

// 读取图片文件
async function readImageFile(filePath: string): Promise<ReturnType<typeof jsonResult>> {
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.bmp') mimeType = 'image/bmp';
    else if (ext === '.svg') mimeType = 'image/svg+xml';

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return jsonResult({
      type: 'image',
      content: dataUrl,
      path: filePath,
      size: buffer.length,
    });
  } catch (error) {
    return errorResult(`Failed to read image: ${error}`);
  }
}

// 读取文本文件
async function readTextFile(filePath: string, from: number, lines: number): Promise<ReturnType<typeof jsonResult>> {
  const content = await fs.readFile(filePath, 'utf-8');
  const allLines = content.split('\n');

  const startIndex = Math.max(0, from - 1);
  const endIndex = Math.min(allLines.length, startIndex + lines);

  const selectedLines = allLines.slice(startIndex, endIndex);
  const selectedContent = selectedLines.join('\n');

  return jsonResult({
    type: 'text',
    content: selectedContent,
    lines: selectedLines.length,
    totalLines: allLines.length,
    from,
    to: endIndex,
    path: filePath,
  });
}

// 解析页码范围
function parsePageRange(pages: string, totalPages: number): number[] {
  const result: number[] = [];
  const parts = pages.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      for (let i = start; i <= Math.min(end, totalPages); i++) {
        if (i >= 1) result.push(i);
      }
    } else {
      const num = Number(trimmed);
      if (num >= 1 && num <= totalPages) result.push(num);
    }
  }

  return [...new Set(result)].sort((a, b) => a - b);
}
