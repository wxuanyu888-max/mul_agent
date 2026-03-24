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
 * Upload a file (image or PDF)
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
    'application/pdf'
  ];
  return allowedTypes.includes(file.type);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
