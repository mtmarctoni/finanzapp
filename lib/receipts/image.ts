import { createHash } from 'node:crypto';

/**
 * Upload guards for the receipt endpoint.
 *
 * The bytes are read once, validated once, hashed once, and handed to the
 * model as a data URL. They are never written to disk or to object storage.
 */

/** 4 MiB. A 1600px JPEG from a phone camera is well under this. */
export const MAX_IMAGE_BYTES = 4_194_304;

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** ISO-BMFF brands that mean "HEIF-family image", mapped to their MIME type. */
const HEIF_BRANDS: Record<string, AcceptedImageType> = {
  heic: 'image/heic',
  heix: 'image/heic',
  hevc: 'image/heic',
  hevx: 'image/heic',
  mif1: 'image/heif',
  msf1: 'image/heif',
};

export class ReceiptImageError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ReceiptImageError';
    this.statusCode = statusCode;
  }
}

export interface GuardedImage {
  bytes: Buffer;
  mediaType: AcceptedImageType;
  contentHash: string;
  byteLength: number;
}

/**
 * Identify an image from its magic bytes.
 *
 * Deliberately ignores any declared MIME type: a client sets `File.type`
 * freely, so an HTML or JavaScript payload can arrive labelled
 * `image/png`. Returns `null` for anything unrecognised, including a
 * truncated header.
 */
export function detectImageType(bytes: Buffer): AcceptedImageType | null {
  // JPEG: SOI marker FF D8 followed by any marker byte.
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // PNG: the full 8-byte signature.
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF container whose form type is WEBP.
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // HEIF/HEIC: ISO-BMFF box whose first child is `ftyp` with a known brand.
  if (bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp') {
    const brand = bytes.toString('ascii', 8, 12).toLowerCase();
    return HEIF_BRANDS[brand] ?? null;
  }

  return null;
}

export async function validateImageUpload(file: File): Promise<GuardedImage> {
  if (file.size === 0) {
    throw new ReceiptImageError('El archivo está vacío.', 400);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new ReceiptImageError(
      `El archivo es demasiado grande. Máximo ${MAX_IMAGE_BYTES} bytes.`,
      413,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Re-check after reading: `File.size` is metadata, not a guarantee.
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ReceiptImageError(
      `El archivo es demasiado grande. Máximo ${MAX_IMAGE_BYTES} bytes.`,
      413,
    );
  }

  const mediaType = detectImageType(bytes);
  if (!mediaType) {
    throw new ReceiptImageError(
      'El archivo no es una imagen válida. Se aceptan JPEG, PNG, WebP, HEIC y HEIF.',
      415,
    );
  }

  return {
    bytes,
    mediaType,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.byteLength,
  };
}

/** Data URL for the AI SDK `ImagePart`. */
export function toDataUrl(image: GuardedImage): string {
  return `data:${image.mediaType};base64,${image.bytes.toString('base64')}`;
}
