import { useRef, useState } from 'react';
import { Paperclip, X, Image, FileText, CheckCircle } from 'lucide-react';
import { uploadFile, isAllowedFileType, formatFileSize } from '../../services/endpoints/files';
import { Attachment } from '../../types';

interface FileUploadButtonProps {
  onFilesSelected: (attachments: Attachment[]) => void;
  disabled?: boolean;
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
        const metadata = await uploadFile(file);

        uploadedFiles.push({
          id: metadata.id,
          filename: metadata.filename,
          originalName: metadata.originalName,
          mimeType: metadata.mimeType,
          size: metadata.size,
          url: `/api/v1/files/${metadata.id}`,
          status: 'done'  // 直接完成，不需要提取
        });
      }

      onFilesSelected(uploadedFiles);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('文件上传失败，请重试');
    } finally {
      setIsUploading(false);
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
  const isImage = attachment.mimeType.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes((attachment.originalName || '').toLowerCase().split('.').pop() || '');
  const isPdf = attachment.mimeType === 'application/pdf';
  const isMarkdown = attachment.mimeType === 'text/markdown' ||
                     attachment.mimeType === 'text/x-markdown' ||
                     attachment.mimeType === 'text/plain' ||
                     attachment.originalName?.endsWith('.md');

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
      </div>

      {/* Status */}
      <div className="flex items-center gap-1 text-xs text-green-600">
        <CheckCircle className="w-3 h-3" />
        已上传
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