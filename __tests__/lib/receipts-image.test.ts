/** @jest-environment node */

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  ReceiptImageError,
  detectImageType,
  toDataUrl,
  validateImageUpload,
} from '@/lib/receipts/image';

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0x00, 0x01]),
]);
const HEIC = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypheic', 'ascii'),
]);
const HEIF = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypmif1', 'ascii'),
]);
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>', 'utf8');

function makeFile(bytes: Buffer, type: string, name = 'receipt'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('detectImageType', () => {
  it.each([
    [JPEG, 'image/jpeg'],
    [PNG, 'image/png'],
    [WEBP, 'image/webp'],
    [HEIC, 'image/heic'],
    [HEIF, 'image/heif'],
  ])('detects %#', (bytes, expected) => {
    expect(detectImageType(bytes)).toBe(expected);
  });

  it('rejects an HTML payload', () => {
    expect(detectImageType(HTML)).toBeNull();
  });

  it('rejects a truncated image', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects an unknown ISO-BMFF brand', () => {
    const mp4 = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypmp42', 'ascii'),
    ]);
    expect(detectImageType(mp4)).toBeNull();
  });
});

describe('validateImageUpload', () => {
  it('accepts every advertised type', async () => {
    for (const [bytes, expected] of [
      [JPEG, 'image/jpeg'],
      [PNG, 'image/png'],
      [WEBP, 'image/webp'],
      [HEIC, 'image/heic'],
      [HEIF, 'image/heif'],
    ] as const) {
      const guarded = await validateImageUpload(makeFile(bytes, expected));
      expect(guarded.mediaType).toBe(expected);
      expect(ACCEPTED_IMAGE_TYPES).toContain(guarded.mediaType);
    }
  });

  // Review Focus #1: the declared Content-Type is attacker-controlled.
  it('trusts the magic bytes, not the declared MIME type', async () => {
    const guarded = await validateImageUpload(
      makeFile(PNG, 'image/jpeg', 'totally-a-png.jpg'),
    );
    expect(guarded.mediaType).toBe('image/png');
  });

  it('rejects a non-image even when it claims to be a PNG', async () => {
    await expect(
      validateImageUpload(makeFile(HTML, 'image/png', 'evil.png')),
    ).rejects.toMatchObject({ statusCode: 415 });
  });

  it('rejects an empty file with 400', async () => {
    await expect(
      validateImageUpload(makeFile(Buffer.alloc(0), 'image/png')),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a file over the size cap with 413', async () => {
    const oversized = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES, 0x41)]);
    await expect(
      validateImageUpload(makeFile(oversized, 'image/png')),
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it('throws ReceiptImageError, so the route can reuse the status code', async () => {
    await expect(
      validateImageUpload(makeFile(HTML, 'image/png')),
    ).rejects.toBeInstanceOf(ReceiptImageError);
  });

  it('returns a 64-character hex content hash', async () => {
    const guarded = await validateImageUpload(makeFile(PNG, 'image/png'));
    expect(guarded.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(guarded.byteLength).toBe(PNG.byteLength);
    expect(guarded.bytes).toEqual(PNG);
  });

  it('hashes the same bytes identically and different bytes differently', async () => {
    const first = await validateImageUpload(makeFile(PNG, 'image/png', 'a'));
    const again = await validateImageUpload(makeFile(PNG, 'image/png', 'b'));
    const other = await validateImageUpload(
      makeFile(Buffer.concat([PNG, Buffer.from([0x99])]), 'image/png'),
    );
    expect(again.contentHash).toBe(first.contentHash);
    expect(other.contentHash).not.toBe(first.contentHash);
  });
});

describe('toDataUrl', () => {
  it('round-trips the exact bytes with the detected media type', async () => {
    const guarded = await validateImageUpload(makeFile(PNG, 'image/png'));
    const dataUrl = toDataUrl(guarded);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    const base64 = dataUrl.split(',')[1] ?? '';
    expect(Buffer.from(base64, 'base64')).toEqual(PNG);
  });
});
