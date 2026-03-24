/**
 * File Upload API Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import multer from 'multer';
import { getSessionsPath } from '../../utils/path.js';

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// File metadata interface
export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: string;
}

export function createFilesRouter(): Router {
  const router: Router = Router();

  // Ensure uploads directory exists
  const uploadsDir = path.join(getSessionsPath(), '..', 'uploads');
  fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

  /**
   * POST /api/v1/files/upload
   * Upload a file (image or PDF)
   */
  // Configure multer for this route
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('File type not allowed'));
      }
    }
  });

  router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      return handleFileUpload(file, res);
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'File upload failed'
      });
    }
  });

  async function handleFileUpload(file: any, res: Response) {
    // Validate file type
    const mimeType = file.mimetype || file.type;
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        error: `File type not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    // Validate file size
    const size = file.size;
    if (size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }

    // Generate unique file ID
    const fileId = crypto.randomUUID();
    const ext = path.extname(file.originalname || file.name || 'file');
    const filename = `${fileId}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Save file
    try {
      // If file is already saved by multer/express-fileupload
      if (file.path) {
        // Move or copy to our uploads directory
        await fs.copyFile(file.path, filepath);
        // Optionally remove original
        await fs.unlink(file.path).catch(() => {});
      } else if (file.data) {
        // Data is in memory (express-fileupload)
        await fs.writeFile(filepath, file.data);
      } else {
        return res.status(500).json({
          success: false,
          error: 'Unable to process file data'
        });
      }

      const metadata: FileMetadata = {
        id: fileId,
        filename,
        originalName: file.originalname || file.name || 'unknown',
        mimeType,
        size,
        path: filepath,
        createdAt: new Date().toISOString()
      };

      res.json({
        success: true,
        data: metadata
      });
    } catch (error) {
      console.error('Error saving file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save file'
      });
    }
  }

  /**
   * GET /api/v1/files/:fileId
   * Get file by ID
   */
  router.get('/files/:fileId', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;

      // Find file in uploads directory
      const files = await fs.readdir(uploadsDir);
      const targetFile = files.find(f => f.startsWith(fileId));

      if (!targetFile) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const filepath = path.join(uploadsDir, targetFile);
      const stat = await fs.stat(filepath);
      const ext = path.extname(targetFile).toLowerCase();

      // Determine mime type based on extension
      let mimeType = 'application/octet-stream';
      if (['.png'].includes(ext)) mimeType = 'image/png';
      else if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (['.gif'].includes(ext)) mimeType = 'image/gif';
      else if (['.webp'].includes(ext)) mimeType = 'image/webp';
      else if (['.pdf'].includes(ext)) mimeType = 'application/pdf';

      // Set appropriate headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `inline; filename="${targetFile}"`);

      // Stream file to response
      const fileStream = await fs.open(filepath, 'r');
      fileStream.createReadStream().pipe(res);
    } catch (error) {
      console.error('Error getting file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file'
      });
    }
  });

  /**
   * GET /api/v1/files/:fileId/metadata
   * Get file metadata only
   */
  router.get('/files/:fileId/metadata', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;

      // Find file in uploads directory
      const files = await fs.readdir(uploadsDir);
      const targetFile = files.find(f => f.startsWith(fileId));

      if (!targetFile) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const filepath = path.join(uploadsDir, targetFile);
      const stat = await fs.stat(filepath);
      const ext = path.extname(targetFile).toLowerCase();

      // Determine mime type based on extension
      let mimeType = 'application/octet-stream';
      if (['.png'].includes(ext)) mimeType = 'image/png';
      else if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (['.gif'].includes(ext)) mimeType = 'image/gif';
      else if (['.webp'].includes(ext)) mimeType = 'image/webp';
      else if (['.pdf'].includes(ext)) mimeType = 'application/pdf';

      const metadata: FileMetadata = {
        id: fileId,
        filename: targetFile,
        originalName: targetFile.replace(/^[a-f0-9-]{36}/, '').replace(/^_/, ''),
        mimeType,
        size: stat.size,
        path: filepath,
        createdAt: stat.birthtime.toISOString()
      };

      res.json({
        success: true,
        data: metadata
      });
    } catch (error) {
      console.error('Error getting file metadata:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file metadata'
      });
    }
  });

  return router;
}
