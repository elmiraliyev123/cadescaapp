"use client";

import { useState, useRef, useCallback } from "react";
import { verifyStudentIdOCR } from "@/app/actions/verifyStudentIdOCR";

interface StudentIdUploaderProps {
  onSuccess: (data: { firstName: string; lastName: string; universityName: string; studentIdImage: string }) => void;
  onError: (error: string) => void;
  /** Called when OCR fails gracefully and the account needs manual review. */
  onManualReview?: (data: { studentIdImage: string; error?: string }) => void;
}

/** Maximum raw file size we accept before compression (10MB). */
const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024;

/** Target compressed size: stay below the private bucket's 1MB object limit. */
const MAX_COMPRESSED_BYTES = 950 * 1024;

const ACCEPTED_SOURCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

const ACCEPTED_SOURCE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

const DIMENSION_STEPS = [2200, 2000, 1800, 1600, 1400];
const QUALITY_STEPS = [0.92, 0.88, 0.84, 0.8, 0.76, 0.72];

type CompressionResult = {
  dataUrl: string;
  outputBytes: number;
  outputMimeType: "image/jpeg";
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  quality: number;
  attempts: number;
};

function isSupportedImageFile(file: File) {
  return ACCEPTED_SOURCE_MIME_TYPES.has(file.type.toLowerCase()) || ACCEPTED_SOURCE_EXTENSIONS.test(file.name);
}

function base64ByteSize(dataUrl: string) {
  const base64Part = dataUrl.split(",")[1] || "";
  const padding = base64Part.endsWith("==") ? 2 : base64Part.endsWith("=") ? 1 : 0;
  return Math.floor((base64Part.length * 3) / 4) - padding;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_decode_failed"));
    };

    img.src = objectUrl;
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): Promise<{ dataUrl: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("image_encode_failed"));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          resolve({ dataUrl, bytes: blob.size || base64ByteSize(dataUrl) });
        };
        reader.onerror = () => reject(new Error("image_encode_failed"));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Compresses an image file on the client using an off-screen canvas.
 * Returns a readable JPEG data URL under the private bucket limit.
 */
async function compressImage(file: File): Promise<CompressionResult> {
  console.info("[student_id_ocr]", {
    stage: "compression",
    event: "start",
    sourceMimeType: file.type || "unknown",
    rawBytes: file.size
  });

  const img = await loadImage(file);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  let attempts = 0;
  let lastResult: CompressionResult | null = null;

  for (const maxDimension of DIMENSION_STEPS) {
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas_context_unavailable");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      attempts++;
      const encoded = await canvasToJpegDataUrl(canvas, quality);
      lastResult = {
        dataUrl: encoded.dataUrl,
        outputBytes: encoded.bytes,
        outputMimeType: "image/jpeg",
        originalWidth,
        originalHeight,
        width,
        height,
        quality,
        attempts
      };

      if (encoded.bytes <= MAX_COMPRESSED_BYTES) {
        console.info("[student_id_ocr]", {
          stage: "compression",
          event: "succeeded",
          sourceMimeType: file.type || "unknown",
          outputMimeType: "image/jpeg",
          rawBytes: file.size,
          outputBytes: encoded.bytes,
          originalWidth,
          originalHeight,
          width,
          height,
          quality,
          attempts
        });
        return lastResult;
      }
    }
  }

  console.info("[student_id_ocr]", {
    stage: "compression",
    event: "failed",
    sourceMimeType: file.type || "unknown",
    rawBytes: file.size,
    outputBytes: lastResult?.outputBytes || null,
    maxBytes: MAX_COMPRESSED_BYTES,
    attempts
  });
  throw new Error("compressed_image_too_large");
}

export function StudentIdUploader({ onSuccess, onError, onManualReview }: StudentIdUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetInput = useCallback(() => {
    setPreview(null);
    setStatusText(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedImageFile(file)) {
      onError("Please upload a valid JPG, PNG, WebP, HEIC, or HEIF image.");
      return;
    }

    if (file.size > MAX_RAW_FILE_BYTES) {
      onError("File size must be under 10MB.");
      return;
    }

    setIsProcessing(true);
    setStatusText("Compressing image...");

    try {
      // Compress before sending to avoid Vercel's request payload limit and the private bucket object limit.
      const compressed = await compressImage(file);
      setPreview(compressed.dataUrl);
      setStatusText("Analyzing Student ID...");

      const result = await verifyStudentIdOCR(compressed.dataUrl);

      // Graceful manual review fallback
      if (result.manualReview) {
        setStatusText(null);
        if (onManualReview) {
          onManualReview({ studentIdImage: compressed.dataUrl, error: result.error });
        } else {
          onError(result.error || "Your ID will be reviewed manually by our team.");
        }
        resetInput();
        return;
      }

      if (!result.success || !result.data) {
        onError(result.error || "Verification failed.");
        resetInput();
        return;
      }

      if (!result.data.isCurrentlyValid) {
        setStatusText(null);
        if (onManualReview) {
          onManualReview({
            studentIdImage: compressed.dataUrl,
            error: "We couldn't confirm the current validity of your Student ID automatically. Your account will be reviewed manually by our team."
          });
        } else {
          onError("The uploaded Student ID could not be automatically verified.");
        }
        resetInput();
        return;
      }

      setStatusText(null);
      onSuccess({
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        universityName: result.data.universityName,
        studentIdImage: compressed.dataUrl
      });
    } catch (caughtError) {
      const reason = caughtError instanceof Error ? caughtError.message : "unknown";
      console.info("[student_id_ocr]", {
        stage: "upload",
        event: "failed",
        reason
      });
      if (reason === "image_decode_failed") {
        onError("This image could not be read by your browser. Please try a clearer JPG, PNG, WebP, HEIC, or HEIF image.");
      } else if (reason === "compressed_image_too_large") {
        onError("The image is too large after compression. Please upload a clearer cropped photo of the Student ID.");
      } else {
        onError("An unexpected error occurred during verification.");
      }
      resetInput();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-outline-variant/70 rounded-xl bg-surface-container-lowest text-center transition-colors hover:border-primary/50 relative overflow-hidden">
      {isProcessing && (
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-3"></div>
          <p className="text-body-md font-semibold text-primary">{statusText || "Processing..."}</p>
        </div>
      )}

      {preview ? (
        <div className="w-full max-h-48 overflow-hidden rounded-lg opacity-50 blur-[2px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="ID Preview" className="w-full h-full object-contain" />
        </div>
      ) : (
        <>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-[24px]">id_card</span>
          </div>
          <h3 className="text-label-lg font-bold text-on-surface mb-2">Upload your Student ID</h3>
          <p className="text-body-sm text-on-surface-variant mb-4">
            JPG, PNG, WebP, HEIC, or HEIF, up to 10MB. If automatic verification fails, we store this image privately for manual admin review.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg text-label-md font-semibold transition-colors"
          >
            Select Image
          </button>
        </>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        className="hidden"
      />
    </div>
  );
}
