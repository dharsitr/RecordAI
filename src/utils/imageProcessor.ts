/**
 * Utility functions for client-side image manipulation using HTML5 Canvas API.
 * Supports image rotation, cropping, contrast/brightness enhancement for OCR,
 * and high-quality Blob/File export.
 */

export interface CropRect {
  x: number; // 0 to 1 percentage or absolute pixels
  y: number;
  width: number;
  height: number;
}

export interface ProcessImageOptions {
  rotation: number; // 0, 90, 180, 270 degrees
  crop?: CropRect; // Crop rectangle in normalized coordinates [0..1]
  enhance: boolean; // Contrast & Brightness OCR enhancement flag
  quality?: number; // 0.95 default high quality
}

/**
 * Loads an image File or Blob into an HTMLImageElement
 */
export function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Processes an image element with rotation, crop, and enhancement,
 * rendering the final result onto an HTMLCanvasElement.
 */
export function processImageToCanvas(
  img: HTMLImageElement,
  options: ProcessImageOptions
): HTMLCanvasElement {
  const { rotation, crop, enhance } = options;

  // 1. Calculate dimensions after rotation
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Rotated canvas dimensions
  const rotW = Math.round(origW * cos + origH * sin);
  const rotH = Math.round(origW * sin + origH * cos);

  // Intermediate canvas for rotation
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;
  const rotCtx = rotCanvas.getContext('2d');

  if (!rotCtx) {
    throw new Error('Unable to create 2D canvas context');
  }

  // Draw rotated image
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(img, -origW / 2, -origH / 2);

  // 2. Crop calculations
  let cropX = 0;
  let cropY = 0;
  let cropW = rotW;
  let cropH = rotH;

  if (crop && crop.width > 0 && crop.height > 0) {
    cropX = Math.max(0, Math.round(crop.x * rotW));
    cropY = Math.max(0, Math.round(crop.y * rotH));
    cropW = Math.min(rotW - cropX, Math.round(crop.width * rotW));
    cropH = Math.min(rotH - cropY, Math.round(crop.height * rotH));
  }

  // Final Canvas
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = cropW;
  finalCanvas.height = cropH;
  const finalCtx = finalCanvas.getContext('2d');

  if (!finalCtx) {
    throw new Error('Unable to create final canvas 2D context');
  }

  // Draw cropped section onto final canvas
  finalCtx.drawImage(rotCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  // 3. Contrast & Brightness Enhancement for OCR
  if (enhance) {
    const imageData = finalCtx.getImageData(0, 0, cropW, cropH);
    const data = imageData.data;

    // Contrast factor (+30) & Brightness (+15)
    const contrast = 30;
    const brightness = 15;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      // Red
      let r = data[i] + brightness;
      r = factor * (r - 128) + 128;
      data[i] = Math.min(255, Math.max(0, r));

      // Green
      let g = data[i + 1] + brightness;
      g = factor * (g - 128) + 128;
      data[i + 1] = Math.min(255, Math.max(0, g));

      // Blue
      let b = data[i + 2] + brightness;
      b = factor * (b - 128) + 128;
      data[i + 2] = Math.min(255, Math.max(0, b));
    }

    finalCtx.putImageData(imageData, 0, 0);
  }

  return finalCanvas;
}

/**
 * Converts canvas to a File object maintaining original file name and format
 */
export function exportCanvasToFile(
  canvas: HTMLCanvasElement,
  originalFilename: string,
  mimeType: string = 'image/png'
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Preserve JPEG or PNG MIME type
    const exportType = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'image/jpeg' : 'image/png';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas blob export failed'));
          return;
        }
        const file = new File([blob], originalFilename, {
          type: exportType,
          lastModified: Date.now(),
        });
        resolve(file);
      },
      exportType,
      0.95 // High quality, low compression loss
    );
  });
}
