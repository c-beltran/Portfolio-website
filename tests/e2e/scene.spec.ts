import { expect, test } from '@playwright/test';

/** The live scene (spec §4): product code under /scene, the M3b lab gone. */

test('the M3b lab is gone', async ({ request }) => {
  expect((await request.get('/lab/monitor')).status()).toBe(404);
});

test('serves the live scene', async ({ request }) => {
  expect((await request.get('/scene/scene.glb')).status()).toBe(200);
});
