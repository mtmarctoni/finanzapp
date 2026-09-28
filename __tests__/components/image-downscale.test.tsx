import {
  MAX_DIMENSION,
  TARGET_BYTES,
  downscaleImageFile,
  scaleDimensions,
} from '@/components/ai/imageDownscale';

function fileOf(size: number, type = 'image/jpeg'): File {
  return new File([new Uint8Array(size)], 'receipt.jpg', { type });
}

describe('scaleDimensions', () => {
  it('leaves an image that already fits', () => {
    expect(scaleDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('scales the long edge down and keeps the aspect ratio', () => {
    expect(scaleDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait image by the same rule', () => {
    expect(scaleDimensions(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales', () => {
    expect(scaleDimensions(100, 50, 4000)).toEqual({ width: 100, height: 50 });
  });

  it('never rounds a dimension down to zero', () => {
    const result = scaleDimensions(20000, 3);
    expect(result.width).toBe(MAX_DIMENSION);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it('honours a custom maximum', () => {
    expect(scaleDimensions(1000, 500, 500)).toEqual({
      width: 500,
      height: 250,
    });
  });
});

describe('downscaleImageFile', () => {
  it('returns a small file untouched, without touching the DOM', async () => {
    const small = fileOf(200_000);
    await expect(downscaleImageFile(small)).resolves.toBe(small);
  });

  // jsdom has no canvas, so this is exactly the "cannot decode" path.
  it('returns the original when the runtime cannot decode images', async () => {
    const big = fileOf(TARGET_BYTES + 1);
    await expect(downscaleImageFile(big)).resolves.toBe(big);
  });

  it('returns the original when decoding throws', async () => {
    const original = globalThis.createImageBitmap;
    // `createImageBitmap` is already declared by lib.dom, so this assignment
    // needs no cast — and an unnecessary `@ts-expect-error` fails `tsc` with
    // TS2578, which is why the directive must not be here.
    globalThis.createImageBitmap = jest
      .fn()
      .mockRejectedValue(new Error('unsupported format'));
    try {
      const big = fileOf(TARGET_BYTES + 1);
      await expect(downscaleImageFile(big)).resolves.toBe(big);
    } finally {
      globalThis.createImageBitmap = original;
    }
  });
});
