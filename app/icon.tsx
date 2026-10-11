import { ImageResponse } from 'next/og';

import { AppIcon } from '@/components/ui/app-icon';

export function generateImageMetadata() {
  return [192, 512].map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: 'image/png',
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<AppIcon />, { width: size, height: size });
}
