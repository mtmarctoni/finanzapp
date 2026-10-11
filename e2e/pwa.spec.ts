import { test, expect, type Page } from '@playwright/test';

async function mockProfile(page: Page) {
  // Isolate profile/PWA behavior from the database and OAuth provider.
  await page.route('**/api/auth/session', async (route) =>
    route.fulfill({
      json: {
        user: { id: 'pwa-test', name: 'PWA Test', email: 'pwa@example.com' },
        expires: '2099-01-01T00:00:00.000Z',
      },
    }),
  );
  await page.route('**/api/api-keys', async (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route('**/api/merchants', async (route) =>
    route.fulfill({ json: { merchants: [] } }),
  );
}

test.describe('PWA installation', () => {
  test('serves a public manifest and correctly sized PNG icons', async ({
    request,
  }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain(
      'application/manifest+json',
    );
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      id: '/',
      name: 'FinanzApp',
      short_name: 'FinanzApp',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'es',
      background_color: '#000000',
      theme_color: '#000000',
    });

    for (const size of [192, 512]) {
      const icon = manifest.icons.find(
        (item: { sizes: string }) => item.sizes === `${size}x${size}`,
      );
      expect(icon).toMatchObject({
        type: 'image/png',
        purpose: 'any',
      });
      const image = await request.get(icon.src);
      expect(image.ok()).toBe(true);
      expect(image.headers()['content-type']).toContain('image/png');
      const png = await image.body();
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
    expect(manifest.icons).toContainEqual({
      src: '/icon/512',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    });
  });

  test('links installation metadata even on the signed-out page', async ({
    page,
    request,
  }) => {
    await page.goto('/auth/signin');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute('content', 'FinanzApp');
    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon).toHaveAttribute('sizes', '180x180');
    const href = await icon.getAttribute('href');
    if (!href) throw new Error('Missing Apple touch icon URL');
    const image = await request.get(href);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
    const png = await image.body();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });

  test('shows readable manual installation guidance in the mobile profile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProfile(page);
    await page.goto('/user');
    const guidance = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Instalar FinanzApp' }),
    });
    await expect(
      guidance.getByRole('heading', { name: 'iPhone o iPad' }),
    ).toBeVisible();
    await expect(
      guidance.getByRole('heading', { name: 'Android' }),
    ).toBeVisible();
    await expect(guidance).toContainText('Compartir');
    await expect(guidance).toContainText('Instalar aplicación');
    await expect(guidance).toContainText('necesita conexión a internet');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test('renders visible, opaque artwork inside the maskable safe circle', async ({
    page,
  }) => {
    await page.goto('/auth/signin');
    const pixels = await page.evaluate(async () => {
      const image = new Image();
      image.src = '/icon/512';
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let artwork = 0;
      let outsideSafeCircle = 0;
      let transparent = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const offset = (y * canvas.width + x) * 4;
          if (data[offset + 3] !== 255) transparent++;
          if (data[offset] + data[offset + 1] + data[offset + 2] > 0) {
            artwork++;
            if (
              Math.hypot(
                x + 0.5 - canvas.width / 2,
                y + 0.5 - canvas.height / 2,
              ) >
              canvas.width * 0.4
            ) {
              outsideSafeCircle++;
            }
          }
        }
      }
      return { artwork, outsideSafeCircle, transparent };
    });
    expect(pixels.artwork).toBeGreaterThan(5000);
    expect(pixels.outsideSafeCircle).toBe(0);
    expect(pixels.transparent).toBe(0);
  });

  test('rejects unsupported icon sizes', async ({ request }) => {
    for (const id of ['0', '999999', 'invalid']) {
      const response = await request.get(`/icon/${id}`);
      expect(response.status()).toBe(404);
    }
  });

  test('browser chrome follows the chosen theme instead of the system preference', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockProfile(page);
    await page.goto('/user');
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(page.locator('html')).toHaveClass('dark');
    await expect(themeColor).toHaveCount(1);
    await expect(themeColor).toHaveAttribute('content', '#000000');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('radio', { name: 'Claro' }).click();
    await expect(page.locator('html')).toHaveClass('light');
    await expect(themeColor).toHaveAttribute('content', '#f2f2f7');
    await page.reload();
    await expect(page.locator('html')).toHaveClass('light');
    await expect(themeColor).toHaveAttribute('content', '#f2f2f7');
    await page.goto('/auth/error');
    await expect(
      page.getByRole('heading', { name: 'No pudimos iniciar sesión' }),
    ).toBeVisible();
    await expect(themeColor).toHaveAttribute('content', '#f2f2f7');

    await page.goto('/user');
    await page.getByRole('radio', { name: 'Oscuro' }).click();
    await expect(themeColor).toHaveAttribute('content', '#000000');
  });
});
