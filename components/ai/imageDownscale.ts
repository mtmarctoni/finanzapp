'use client';

/**
 * Client-side image downscaling for receipt uploads.
 *
 * The server accepts up to 4 MiB; this module aims well below that so a
 * modern phone photo never hits the ceiling. No dependency is added: the
 * browser already has `createImageBitmap`, a canvas and `toBlob`.
 *
 * Every failure path returns the input file unchanged. An undecodable image
 * (notably HEIC in some browsers) must still reach the server, which
 * validates magic bytes and hands the bytes to the model as-is.
 */

/** Long edge, in pixels, after scaling. */
export const MAX_DIMENSION = 1600;

/** Files at or below this are uploaded untouched. */
export const TARGET_BYTES = 1_500_000;

/** Re-encode below this so the canvas output is small. */
const REENCODE_QUALITY = 0.82;

export function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };

  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function downscaleImageFile(
  file: File,
  maxDimension: number = MAX_DIMENSION,
): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = scaleDimensions(
      bitmap.width,
      bitmap.height,
      maxDimension,
    );
    if (width === bitmap.width && height === bitmap.height) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', REENCODE_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
