/**
 * Document Parser
 *
 * Support for parsing PDF, DOC, DOCX and other document formats.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ============================================================================
// Supported File Types
// ============================================================================

export type DocumentType = 'pdf' | 'docx' | 'doc' | 'txt' | 'md' | 'code';

export interface ParsedDocument {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    createdDate?: string;
    modifiedDate?: string;
  };
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse a document file based on its extension
 */
export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return parsePDF(filePath);
    case '.docx':
      return parseDOCX(filePath);
    case '.doc':
      return parseDOC(filePath);
    case '.txt':
    case '.md':
      return parseTextFile(filePath);
    default:
      // For code files, also treat as text
      return parseTextFile(filePath);
  }
}

/**
 * Parse PDF file
 */
async function parsePDF(filePath: string): Promise<ParsedDocument> {
  try {
    // Dynamic import to avoid issues if package not available
    const pdfParse = await import('pdf-parse');

    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse.default(dataBuffer);

    return {
      content: data.text,
      metadata: {
        title: data.info?.Title || path.basename(filePath),
        author: data.info?.Author,
        pageCount: data.numpages,
        createdDate: data.info?.CreationDate,
        modifiedDate: data.info?.ModDate,
      },
    };
  } catch (error) {
    console.error(`Failed to parse PDF ${filePath}:`, error);
    return {
      content: '',
      metadata: { title: path.basename(filePath) },
    };
  }
}

/**
 * Parse DOCX file
 */
async function parseDOCX(filePath: string): Promise<ParsedDocument> {
  try {
    const mammoth = await import('mammoth');

    const result = await mammoth.default.extractRawText({ path: filePath });

    return {
      content: result.value,
      metadata: {
        title: path.basename(filePath, '.docx'),
      },
    };
  } catch (error) {
    console.error(`Failed to parse DOCX ${filePath}:`, error);
    return {
      content: '',
      metadata: { title: path.basename(filePath) },
    };
  }
}

/**
 * Parse DOC file (legacy format)
 * Note: DOC is binary and harder to parse without external tools
 * This falls back to text extraction or returns empty
 */
async function parseDOC(filePath: string): Promise<ParsedDocument> {
  // DOC is a binary format that requires special handling
  // Options:
  // 1. Use antiword (external command)
  // 2. Use python's python-docx (but file is .doc not .docx)
  // 3. Convert to DOCX first using external tool

  try {
    // Try to read as binary and extract readable text
    const buffer = await fs.readFile(filePath);

    // Simple text extraction from DOC - very basic
    // In production, use antiword or similar
    const text = extractTextFromDOC(buffer);

    return {
      content: text,
      metadata: {
        title: path.basename(filePath, '.doc'),
      },
    };
  } catch (error) {
    console.error(`Failed to parse DOC ${filePath}:`, error);
    return {
      content: '',
      metadata: { title: path.basename(filePath) },
    };
  }
}

/**
 * Basic text extraction from DOC binary
 * This is a fallback - not comprehensive
 */
function extractTextFromDOC(buffer: Buffer): string {
  // Simple extraction of readable ASCII text from DOC
  // This is very basic and won't work for all DOC files
  let text = '';
  let inText = false;

  for (let i = 0; i < buffer.length - 1; i++) {
    const char = buffer[i];
    const nextChar = buffer[i + 1];

    // Detect text sections (very basic heuristic)
    if (char >= 0x20 && char <= 0x7E) {
      text += String.fromCharCode(char);
      inText = true;
    } else if (inText && (char === 0x0D || char === 0x0A)) {
      text += '\n';
      inText = false;
    }
  }

  // Clean up extracted text
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 3)
    .join('\n')
    .substring(0, 50000); // Limit size
}

/**
 * Parse plain text or markdown file
 */
async function parseTextFile(filePath: string): Promise<ParsedDocument> {
  const content = await fs.readFile(filePath, 'utf-8');

  return {
    content,
    metadata: {
      title: path.basename(filePath),
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a file type is supported for parsing
 */
export function isParsableFile(filename: string): boolean {
  const supportedExtensions = [
    '.pdf',
    '.docx',
    '.doc',
    '.txt',
    '.md',
    '.py',
    '.ts',
    '.js',
    '.jsx',
    '.tsx',
    '.json',
    '.yaml',
    '.yml',
    '.html',
    '.htm',
    '.xml',
    '.csv',
  ];

  const ext = path.extname(filename).toLowerCase();
  return supportedExtensions.includes(ext);
}

/**
 * Get the document type from filename
 */
export function getDocumentType(filename: string): DocumentType {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.doc':
      return 'doc';
    case '.txt':
      return 'txt';
    case '.md':
      return 'md';
    default:
      return 'code';
  }
}

/**
 * Extract text content from various document types
 */
export async function extractText(filePath: string): Promise<string> {
  const parsed = await parseDocument(filePath);
  return parsed.content;
}
