import React, { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ImagePreprocessorModal } from './ImagePreprocessorModal';
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';

export interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'invalid';
  progress: number;
  errorMessage?: string;
  documentId?: string;
  storagePath?: string;
  isPreprocessed?: boolean;
}

interface FileUploadZoneProps {
  experimentId: string;
  onAllUploadsFinished?: (uploadedCount: number) => void;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  experimentId,
  onAllUploadsFinished,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileList, setFileList] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);

  // Preprocessor Modal State
  const [editingItem, setEditingItem] = useState<FileUploadItem | null>(null);
  const [isPreprocessorOpen, setIsPreprocessorOpen] = useState(false);

  // Client-side file validation
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mime = file.type.toLowerCase();

    // Check type
    const isMimeValid = ALLOWED_MIME_TYPES.includes(mime);
    const isExtValid = ALLOWED_EXTENSIONS.includes(ext);
    if (!isMimeValid && !isExtValid) {
      return {
        valid: false,
        error: `Unsupported file type (${ext || 'unknown'}). Please upload JPG, PNG, or PDF files.`,
      };
    }

    // Check size (15MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${sizeMB} MB) exceeds 15MB limit. Please upload a smaller file.`,
      };
    }

    return { valid: true };
  };

  // Add files to state with validation
  const handleAddFiles = (files: FileList | File[]) => {
    const newItems: FileUploadItem[] = Array.from(files).map((file) => {
      const validation = validateFile(file);
      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: validation.valid ? 'pending' : 'invalid',
        progress: 0,
        errorMessage: validation.error,
      };
    });

    setFileList((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    setFileList((prev) => prev.filter((item) => item.id !== id));
  };

  // Open Preprocessing modal for an image item
  const handleOpenPreprocessor = (item: FileUploadItem) => {
    setEditingItem(item);
    setIsPreprocessorOpen(true);
  };

  // Replace raw file with processed Blob/File from Canvas export
  const handleSaveProcessedFile = (processedFile: File) => {
    if (!editingItem) return;

    setFileList((prev) =>
      prev.map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            file: processedFile,
            size: processedFile.size,
            type: processedFile.type,
            status: 'pending',
            progress: 0,
            errorMessage: undefined,
            isPreprocessed: true,
          };
        }
        return item;
      })
    );
  };

  // Single file upload procedure
  const uploadSingleFile = async (item: FileUploadItem): Promise<boolean> => {
    if (!user || !experimentId) return false;
    if (item.status === 'invalid') return false;

    // Update status to uploading
    setFileList((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading', progress: 20, errorMessage: undefined } : f))
    );

    try {
      // 1. Storage Upload Path: lab-uploads/{user_id}/{experiment_id}/{filename}
      const sanitizedName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timePrefix = Date.now();
      const storagePath = `${user.id}/${experimentId}/${timePrefix}_${sanitizedName}`;

      setFileList((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, progress: 50 } : f))
      );

      const { data: storageData, error: storageErr } = await supabase.storage
        .from('lab-uploads')
        .upload(storagePath, item.file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (storageErr) {
        throw new Error(storageErr.message || 'Supabase storage upload failed.');
      }

      setFileList((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, progress: 80 } : f))
      );

      // 2. Insert corresponding documents row in database
      const ext = item.name.split('.').pop()?.toLowerCase() || 'unknown';
      const fileType = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpg';

      const { data: docData, error: docErr } = await supabase
        .from('documents')
        .insert({
          experiment_id: experimentId,
          file_path: storageData.path || storagePath,
          file_type: fileType,
          processing_status: 'uploaded',
        })
        .select()
        .single();

      if (docErr) {
        throw new Error(docErr.message || 'Database record insertion failed.');
      }

      // Mark success
      setFileList((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: 'success',
                progress: 100,
                documentId: docData.id,
                storagePath: storageData.path || storagePath,
              }
            : f
        )
      );

      return true;
    } catch (err: any) {
      console.error(`[FileUploadZone] Error uploading ${item.name}:`, err);
      setFileList((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: 'error',
                progress: 0,
                errorMessage: err?.message || 'Upload failed. Click Retry to try again.',
              }
            : f
        )
      );
      return false;
    }
  };

  // Upload all pending/failed valid files
  const handleUploadAll = async () => {
    const toUpload = fileList.filter(
      (f) => f.status === 'pending' || f.status === 'error'
    );

    if (toUpload.length === 0) return;

    setIsUploadingAll(true);
    let successCount = 0;

    for (const item of toUpload) {
      const ok = await uploadSingleFile(item);
      if (ok) successCount++;
    }

    setIsUploadingAll(false);

    // Count all successful files
    const totalSuccessful = fileList.filter((f) => f.status === 'success').length + successCount;
    if (onAllUploadsFinished) {
      onAllUploadsFinished(totalSuccessful);
    }
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-400" />;
    if (['jpg', 'jpeg', 'png'].includes(ext || '')) return <ImageIcon className="h-5 w-5 text-cyan-400" />;
    return <FileCode className="h-5 w-5 text-gray-400" />;
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png'].includes(ext);
  };

  const pendingCount = fileList.filter((f) => f.status === 'pending' || f.status === 'error').length;
  const hasInvalid = fileList.some((f) => f.status === 'invalid');

  return (
    <div className="space-y-6">
      {/* Dropzone area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`glass-panel rounded-2xl p-8 text-center border-2 border-dashed transition-all cursor-pointer group ${
          isDragging
            ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
            : 'border-gray-800 hover:border-emerald-500/50 hover:bg-gray-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
          <UploadCloud className="h-7 w-7" />
        </div>

        <h3 className="text-base font-semibold text-white mt-3">
          Drag & Drop Lab Notebook Pages / PDFs
        </h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
          Supports multiple files: <span className="text-gray-300 font-medium">JPG, PNG, PDF</span> (Max 15MB per file)
        </p>

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-800 border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-200 group-hover:border-emerald-500/40 group-hover:text-emerald-300 transition-all"
        >
          Select Files from Device
        </button>
      </div>

      {/* Selected File List */}
      {fileList.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              Selected Files ({fileList.length})
            </h4>
            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <button
                  type="button"
                  disabled={isUploadingAll}
                  onClick={handleUploadAll}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isUploadingAll ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5" />
                      <span>Upload All ({pendingCount})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {hasInvalid && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />
              <span>Some selected files failed validation. Please remove or fix them before proceeding.</span>
            </div>
          )}

          <div className="space-y-3">
            {fileList.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-3.5 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-800 border border-gray-700">
                    {getFileIcon(item.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-white truncate max-w-xs sm:max-w-md">
                        {item.name}
                      </p>
                      {item.isPreprocessed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          <Sparkles className="h-3 w-3" />
                          Enhanced
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatBytes(item.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {/* Preprocess / Crop Button for Images */}
                  {isImageFile(item.name) && item.status !== 'uploading' && item.status !== 'success' && (
                    <button
                      type="button"
                      onClick={() => handleOpenPreprocessor(item)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title="Crop, rotate, and enhance image contrast for OCR"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Preprocess</span>
                    </button>
                  )}

                  {/* Status Indicator */}
                  {item.status === 'pending' && (
                    <span className="text-xs font-medium text-gray-400 bg-gray-800 px-2.5 py-1 rounded-md">
                      Ready
                    </span>
                  )}

                  {item.status === 'uploading' && (
                    <div className="flex items-center gap-2 text-xs font-medium text-cyan-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Uploading ({item.progress}%)</span>
                    </div>
                  )}

                  {item.status === 'success' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Uploaded
                    </span>
                  )}

                  {item.status === 'error' && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Failed
                      </span>
                      <button
                        type="button"
                        onClick={() => uploadSingleFile(item)}
                        className="p-1 rounded-md text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 transition-colors"
                        title="Retry Upload"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {item.status === 'invalid' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md max-w-xs truncate">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      {item.errorMessage || 'Invalid File'}
                    </span>
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(item.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preprocessor Modal */}
      <ImagePreprocessorModal
        item={editingItem}
        isOpen={isPreprocessorOpen}
        onClose={() => setIsPreprocessorOpen(false)}
        onConfirm={handleSaveProcessedFile}
      />
    </div>
  );
};
