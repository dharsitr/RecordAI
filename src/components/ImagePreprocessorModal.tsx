import React, { useEffect, useRef, useState } from 'react';
import { FileUploadItem } from './FileUploadZone';
import {
  exportCanvasToFile,
  loadImageFromFile,
  processImageToCanvas,
} from '../utils/imageProcessor';
import {
  Check,
  Crop,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
  Sliders,
  X,
} from 'lucide-react';

interface ImagePreprocessorModalProps {
  item: FileUploadItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (processedFile: File) => void;
}

export const ImagePreprocessorModal: React.FC<ImagePreprocessorModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  // Preprocessing options state
  const [rotation, setRotation] = useState<number>(0);
  const [enhance, setEnhance] = useState<boolean>(true); // Enabled by default for handwritten lab pages
  const [viewMode, setViewMode] = useState<'after' | 'before' | 'split'>('after');
  const [cropInset, setCropInset] = useState<{ top: number; left: number; right: number; bottom: number }>({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [processingSave, setProcessingSave] = useState<boolean>(false);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string>('');

  // Load image when modal opens
  useEffect(() => {
    if (isOpen && item && item.file) {
      setLoading(true);
      setRotation(0);
      setEnhance(true);
      setCropInset({ top: 0, left: 0, right: 0, bottom: 0 });

      const objectUrl = URL.createObjectURL(item.file);
      setOriginalPreviewUrl(objectUrl);

      loadImageFromFile(item.file)
        .then((img) => {
          setImageElement(img);
          setLoading(false);
        })
        .catch((err) => {
          console.error('[ImagePreprocessorModal] Image load error:', err);
          setLoading(false);
        });

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }
  }, [isOpen, item]);

  // Update Canvas preview whenever options or image change
  useEffect(() => {
    if (!imageElement || !canvasRef.current) return;

    const cropRect = {
      x: cropInset.left / 100,
      y: cropInset.top / 100,
      width: (100 - cropInset.left - cropInset.right) / 100,
      height: (100 - cropInset.top - cropInset.bottom) / 100,
    };

    const renderedCanvas = processImageToCanvas(imageElement, {
      rotation,
      crop: cropRect,
      enhance: viewMode === 'before' ? false : enhance,
    });

    const targetCanvas = canvasRef.current;
    targetCanvas.width = renderedCanvas.width;
    targetCanvas.height = renderedCanvas.height;
    const ctx = targetCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, renderedCanvas.width, renderedCanvas.height);
      ctx.drawImage(renderedCanvas, 0, 0);
    }
  }, [imageElement, rotation, enhance, cropInset, viewMode]);

  if (!isOpen || !item) return null;

  const handleRotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);

  const handleSave = async () => {
    if (!imageElement || !item) return;

    try {
      setProcessingSave(true);

      const cropRect = {
        x: cropInset.left / 100,
        y: cropInset.top / 100,
        width: (100 - cropInset.left - cropInset.right) / 100,
        height: (100 - cropInset.top - cropInset.bottom) / 100,
      };

      const finalCanvas = processImageToCanvas(imageElement, {
        rotation,
        crop: cropRect,
        enhance,
      });

      const processedFile = await exportCanvasToFile(
        finalCanvas,
        item.name,
        item.type || 'image/png'
      );

      onConfirm(processedFile);
      onClose();
    } catch (err) {
      console.error('[ImagePreprocessorModal] Save error:', err);
    } finally {
      setProcessingSave(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel rounded-2xl w-full max-w-4xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Preprocess Image for OCR</h2>
              <p className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md">{item.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body & Controls Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-y-auto">
          {/* Main Canvas / Image Preview Area */}
          <div className="md:col-span-2 p-6 flex flex-col items-center justify-center bg-gray-950/60 min-h-[320px] relative">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-emerald-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs font-medium">Loading image canvas...</span>
              </div>
            ) : (
              <div className="relative max-w-full max-h-[450px] flex items-center justify-center overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80 p-2 shadow-inner">
                {viewMode === 'before' ? (
                  <img
                    src={originalPreviewUrl}
                    alt="Original"
                    className="max-h-[420px] object-contain rounded"
                  />
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="max-h-[420px] max-w-full object-contain rounded transition-all"
                  />
                )}

                {/* View Mode Indicator Badge */}
                <div className="absolute top-4 right-4 bg-gray-950/80 backdrop-blur border border-gray-800 px-3 py-1 rounded-full text-[11px] font-semibold text-emerald-400">
                  {viewMode === 'before' ? 'Original (Before)' : 'Enhanced (After)'}
                </div>
              </div>
            )}
          </div>

          {/* Controls Sidebar Panel */}
          <div className="p-6 border-t md:border-t-0 md:border-l border-gray-800/80 space-y-6 bg-gray-900/20">
            {/* 1. Before / After Comparison */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Preview Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-gray-900/80 p-1 rounded-xl border border-gray-800">
                <button
                  type="button"
                  onClick={() => setViewMode('after')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === 'after'
                      ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>After</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('before')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === 'before'
                      ? 'bg-gray-800 text-white border border-gray-700'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Before</span>
                </button>
              </div>
            </div>

            {/* 2. Rotation Controls */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Rotate Image ({rotation}°)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRotateLeft}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-800 bg-gray-900/80 text-xs font-semibold text-gray-200 hover:bg-gray-800 hover:border-gray-700 transition-all"
                >
                  <RotateCcw className="h-4 w-4 text-emerald-400" />
                  <span>Left 90°</span>
                </button>
                <button
                  type="button"
                  onClick={handleRotateRight}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-800 bg-gray-900/80 text-xs font-semibold text-gray-200 hover:bg-gray-800 hover:border-gray-700 transition-all"
                >
                  <RotateCw className="h-4 w-4 text-cyan-400" />
                  <span>Right 90°</span>
                </button>
              </div>
            </div>

            {/* 3. OCR Contrast & Brightness Enhancement */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                OCR Enhancement
              </label>
              <button
                type="button"
                onClick={() => setEnhance(!enhance)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  enhance
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-gray-800 bg-gray-900/60 text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>Contrast & Brightness Boost</span>
                </div>
                <div
                  className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
                    enhance ? 'bg-emerald-500' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-gray-950 transition-transform ${
                      enhance ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
              <p className="text-[11px] text-gray-500">
                Enhances handwritten ink contrast and brightens background for optimal AI extraction.
              </p>
            </div>

            {/* 4. Crop Tool Sliders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Page Crop Trimming
                </label>
                <Crop className="h-3.5 w-3.5 text-emerald-400" />
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Top Margin</span>
                    <span>{cropInset.top}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={cropInset.top}
                    onChange={(e) => setCropInset((prev) => ({ ...prev, top: Number(e.target.value) }))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Bottom Margin</span>
                    <span>{cropInset.bottom}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={cropInset.bottom}
                    onChange={(e) => setCropInset((prev) => ({ ...prev, bottom: Number(e.target.value) }))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-gray-900/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={processingSave || loading}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-2.5 text-xs font-bold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
          >
            {processingSave ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-gray-950" />
                <span>Exporting Image...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Apply & Confirm Image</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
