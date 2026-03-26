/**
 * File Upload API Endpoints
 */

import client from './client';

// File metadata type
export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: string;
}

// File extraction result
export interface ExtractResult {
  success: boolean;
  data?: {
    content: string;
    charCount: number;
  };
  error?: string;
}

interface UploadResponse {
  success: boolean;
  data?: FileMetadata;
  error?: string;
}

interface MetadataResponse {
  success: boolean;
  data?: FileMetadata;
  error?: string;
}

/**
 * Upload a file (image, PDF, or markdown)
 */
export async function uploadFile(file: File): Promise<FileMetadata> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/files/upload', {
    method: 'POST',
    body: formData,
  });

  const result: UploadResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Upload failed');
  }

  return result.data;
}

/**
 * Extract text content from a file
 */
export async function extractFileContent(fileId: string): Promise<ExtractResult> {
  try {
    const response = await fetch(`/api/v1/files/${fileId}/extract`);
    const result: ExtractResult = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Extract failed'
      };
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extract failed'
    };
  }
}

/**
 * Get file metadata by ID
 */
export async function getFileMetadata(fileId: string): Promise<FileMetadata> {
  const response = await fetch(`/api/v1/files/${fileId}/metadata`);
  const result: MetadataResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get file metadata');
  }

  return result.data;
}

/**
 * Get file URL for display
 */
export function getFileUrl(fileId: string): string {
  return `/api/v1/files/${fileId}`;
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(file: File): boolean {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/markdown',
    'text/x-markdown',
    'text/plain'
  ];

  // Check by mime type or extension
  const hasAllowedMime = allowedTypes.includes(file.type);
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'md', 'txt'];
  const hasAllowedExt = allowedExts.includes(ext);

  return hasAllowedMime || hasAllowedExt;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
