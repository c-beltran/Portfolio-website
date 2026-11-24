import { expect, test } from './fixtures';

/**
 * The local server (`pnpm serve:out`, Playwright's webServer). serve-handler (6.1.6, unchanged in
 * 6.1.8) opens a file before checking its ETag and never closes it when it answers 304, so every
 * revalidated file leaks a handle; after enough reloads it dies with EMFILE.
 * With --no-etag it sends Last-Modified instead and only ever answers in full. Vercel serves
 * production, so this is local only.
 */
test.describe('the local server', () => {
  test.skip(({ isMobile }) => isMobile, 'one run is enough');
  test.skip(!!process.env.PREVIEW_URL, 'the local server only');

  test('never answers 304, so it never leaks a file handle', async ({ request }) => {
    const first = await request.get('/glow/photo-ring.webp');
    expect(first.status()).toBe(200);
    const etag = first.headers().etag;
    expect(etag, 'no ETag to revalidate against').toBeUndefined();
    const again = await request.get('/glow/photo-ring.webp', {
      headers: {
        'If-None-Match': etag ?? '"any"',
        'If-Modified-Since': first.headers()['last-modified'] ?? new Date().toUTCString(),
      },
    });
    expect(again.status()).toBe(200);
  });
});
