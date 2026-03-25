import { useRef, useState } from 'react';
import { Paperclip, X, Image, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadFile, extractFileContent, isAllowedFileType, formatFileSize, type FileMetadata } from '../../services/endpoints/files';
import { Attachment, AttachmentStatus } from '../../types';

interface FileUploadButtonProps {
  onFilesSelected: (attachments: Attachment[]) => void;
  disabled?: boolean;
}

// 判断是否为图片类型
function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function FileUploadButton({ onFilesSelected, disabled }: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => {
      if (!isAllowedFileType(file)) {
        console.warn(`File type ${file.type} is not allowed`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedFiles: Attachment[] = [];

      for (const file of validFiles) {
        // 1. 先上传文件
        const metadata = await uploadFile(file);

        // 创建附件对象，上传状态
        const attachment: Attachment = {
          id: metadata.id,
          filename: metadata.filename,
          originalName: metadata.originalName,
          mimeType: metadata.mimeType,
          size: metadata.size,
          url: `/api/v1/files/${metadata.id}`,
          status: 'uploading'
        };

        uploadedFiles.push(attachment);

        // 2. 图片不需要解析（LLM 直接识别 URL），其他文件需要解析
        if (!isImageType(metadata.mimeType)) {
          // 更新状态为解析中
          attachment.status = 'parsing';

          // 3. 调用解析 API
          const extractResult = await extractFileContent(metadata.id);

          if (extractResult.success && extractResult.data) {
            attachment.status = 'done';
            attachment.extractedText = extractResult.data.content;
          } else {
            attachment.status = 'error';
            attachment.error = extractResult.error || '解析失败';
          }
        } else {
          // 图片直接完成（通过 URL 识别）
          attachment.status = 'done';
        }
      }

      onFilesSelected(uploadedFiles);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('文件上传失败，请重试');
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf,.md,text/markdown,text/x-markdown"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isUploading}
        className={`w-11 h-11 rounded-xl transition-all flex-shrink-0 flex items-center justify-center ${
          disabled || isUploading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
        }`}
        title={isUploading ? '上传中...' : '上传文件（图片、PDF 或 Markdown）'}
      >
        {isUploading ? (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Paperclip className="w-5 h-5" />
        )}
      </button>
    </>
  );
}

// File preview item component
interface FilePreviewItemProps {
  attachment: Attachment;
  onRemove: () => void;
}

export function FilePreviewItem({ attachment, onRemove }: FilePreviewItemProps) {
  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';
  const isMarkdown = attachment.mimeType === 'text/markdown' ||
                     attachment.mimeType === 'text/x-markdown' ||
                     attachment.mimeType === 'text/plain' ||
                     attachment.originalName?.endsWith('.md');

  // 渲染状态图标和文字
  const renderStatus = () => {
    const status = attachment.status || 'done';

    switch (status) {
      case 'uploading':
        return (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            上传中...
          </div>
        );
      case 'parsing':
        return (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            解析中...
          </div>
        );
      case 'done':
        return (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            已解析
            {attachment.extractedText && ` · ${attachment.extractedText.length} 字`}
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1 text-xs text-red-500" title={attachment.error}>
            <AlertCircle className="w-3 h-3" />
            解析失败
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative group flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
      {/* File icon or preview */}
      {isImage && attachment.url ? (
        <img
          src={attachment.url}
          alt={attachment.originalName}
          className="w-8 h-8 object-cover rounded"
        />
      ) : (
        <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded">
          {isPdf ? (
            <FileText className="w-4 h-4 text-red-500" />
          ) : isMarkdown ? (
            <FileText className="w-4 h-4 text-blue-500" />
          ) : (
            <Image className="w-4 h-4 text-gray-500" />
          )}
        </div>
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 truncate max-w-[120px]">
          {attachment.originalName}
        </p>
        <p className="text-xs text-gray-400">
          {formatFileSize(attachment.size)}
        </p>
        {/* 解析状态 */}
        {renderStatus()}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
      >
        <X className="w-3 h-3 text-gray-500" />
      </button>
    </div>
  );
}