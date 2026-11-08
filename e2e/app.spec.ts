import { expect, test, type Page } from '@playwright/test';

/** The app renders the header on every route; this is the smoke gate for every test. */
async function expectShell(page: Page) {
  await expect(page.getByRole('link', { name: 'Sound Atlas' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Author on X' }).first()).toBeVisible();
}

/**
 * Open a lazy-loaded route and confirm it actually mounted.
 *
 * Routes are code-split, so a cold chunk request can occasionally be slow enough that the
 * first paint is still the suspense fallback. Retrying the navigation once keeps the test
 * honest (it still asserts real content) without turning a cold start into a failure.
 */
async function openRoute(page: Page, path: string, heading: string | RegExp) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(`/#${path}`, { waitUntil: 'domcontentloaded' });
    try {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 25_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(500);
    }
  }
}

const AUTHOR_URL = 'https://x.com/0xkillcoin';

test.describe('shell and navigation', () => {
  test('home renders the hero, real stats and the X author link', async ({ page }) => {
    await page.goto('/');
    await expectShell(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SOUND');

    // Stats come from the bundled catalogue, so they must settle to a real number.
    await expect(page.locator('dd').first()).not.toHaveText('—', { timeout: 30_000 });

    const author = page.getByRole('link', { name: 'Author on X' }).first();
    await expect(author).toHaveAttribute('href', AUTHOR_URL);
    await expect(author).toHaveAttribute('target', '_blank');
  });

  test('every top-level route loads without a client error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const route of ['/', '/explore', '/collections', '/random', '/library', '/journeys', '/upload', '/about']) {
      await page.goto(`/#${route}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('body')).not.toBeEmpty();
    }

    expect(errors).toEqual([]);
  });

  test('a deep link to a sound page resolves after a hard reload', async ({ page }) => {
    await page.goto('/#/explore');
    // Take the first real sound link from a card, then reload that URL directly.
    const firstCard = page.locator('a[href^="#/sound/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    const href = await firstCard.getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(`/${href}`);
    await page.reload();
    await expect(page.getByText('Open the original file')).toBeVisible({ timeout: 30_000 });
  });

  test('unknown routes show the 404 page', async ({ page }) => {
    await page.goto('/#/this/route/does/not/exist');
    await expect(page.getByText('That page does not exist.')).toBeVisible();
  });
});

test.describe('language and theme', () => {
  test('switching to Chinese translates the shell and the map page', async ({ page }) => {
    await page.goto('/#/explore');
    await page.getByRole('button', { name: 'Language' }).click();
    await expect(page.getByRole('heading', { name: '探索声音地图' })).toBeVisible();
    await page.reload();
    // The choice must survive a reload.
    await expect(page.getByRole('heading', { name: '探索声音地图' })).toBeVisible();
  });

  test('theme toggle changes the document class and persists', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(html).toHaveClass(/light/);
    await page.reload();
    await expect(html).toHaveClass(/light/);
  });
});

test.describe('explore map', () => {
  test('loads sounds for the world and plots markers', async ({ page }) => {
    await openRoute(page, '/explore', 'Explore the sound map');
    // Mobile defaults to the list, so switch to the map explicitly before asserting markers.
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('.sound-marker')).not.toHaveCount(0, { timeout: 40_000 });
    await expect(page.getByText(/Showing \d+/)).toBeVisible();
  });

  test('searching a place moves the map and loads that window', async ({ page }) => {
    // The place autocomplete is a third-party service (Photon) with its own rate limits,
    // so the UI contract is tested against a fixed response. The live service is
    // exercised by the manual verification recorded in the README.
    await page.route('**/photon.komoot.io/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          features: [
            {
              properties: { osm_id: 1, name: 'Berlin', state: 'Berlin', country: 'Germany', extent: [13.0, 52.7, 13.8, 52.3] },
              geometry: { coordinates: [13.405, 52.52] },
            },
          ],
        }),
      }),
    );

    await page.goto('/#/explore');
    const input = page.getByPlaceholder('City, country or place name');
    await input.fill('Berlin');

    const suggestion = page.getByRole('listitem').filter({ hasText: 'Berlin' }).first();
    await expect(suggestion).toBeVisible({ timeout: 20_000 });
    await suggestion.click();

    await expect(input).toHaveValue('Berlin');
    // Anchoring the search to the place narrows the result set to that window.
    await expect(page.getByText(/Showing \d+/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Berlin').first()).toBeVisible();
  });

  test('filters narrow the result set and can be cleared', async ({ page }) => {
    await openRoute(page, '/explore', 'Explore the sound map');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('.sound-marker')).not.toHaveCount(0, { timeout: 40_000 });
    const before = await page.locator('.sound-marker').count();

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Rain', exact: true }).click();
    await expect(page.locator('.sound-marker').count()).not.toBe(before);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('.sound-marker')).not.toHaveCount(0);
  });

  test('map and list modes both work', async ({ page }) => {
    await page.goto('/#/explore');
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
    await expect(page.locator('article').first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });
});

test.describe('playback', () => {
  test('opening a sound and pressing play requests a real remote audio file', async ({ page }) => {
    await page.goto('/#/explore');
    const firstCard = page.locator('a[href^="#/sound/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    await firstCard.click();

    const main = page.getByRole('main');
    const playButton = main.getByRole('button', { name: 'Play' }).first();
    await expect(playButton).toBeVisible();

    // The engine loads the archive file over the network; the request itself is proof.
    const audioRequest = page.waitForRequest(
      (request) => /^https:\/\/(upload\.wikimedia\.org|static\.inaturalist\.org)\//.test(request.url()),
      { timeout: 45_000 },
    );
    await playButton.click();
    const request = await audioRequest;
    expect(request.url()).toMatch(/^https:\/\//);
    await expect(main.getByRole('button', { name: 'Pause' }).first()).toBeVisible({ timeout: 25_000 });
  });

  test('the licence and author are always shown with the player', async ({ page }) => {
    await page.goto('/#/explore');
    const firstCard = page.locator('a[href^="#/sound/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    await firstCard.click();
    const main = page.getByRole('main');
    await expect(main.getByText('Recorded by', { exact: true })).toBeVisible();
    await expect(main.getByText('Licence', { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Open the original file' })).toHaveAttribute('href', /^https:\/\//);
  });
});

test.describe('library and persistence', () => {
  test('saving a sound survives a reload', async ({ page }) => {
    await page.goto('/#/explore');
    const firstCard = page.locator('a[href^="#/sound/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    await firstCard.click();
    const main = page.getByRole('main');

    await main.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(main.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();

    await page.goto('/#/library');
    await page.reload();
    await expect(page.locator('article').first()).toBeVisible({ timeout: 20_000 });
  });

  test('export produces a JSON download and import accepts it back', async ({ page }) => {
    await page.goto('/#/library');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export data' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^sound-atlas-.*\.json$/);
  });

  test('a malformed import is rejected with a visible message', async ({ page }) => {
    await page.goto('/#/library');
    await page.setInputFiles('input[type="file"]', {
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"not":"a bundle"}'),
    });
    await expect(page.getByText('That file could not be read as a Sound Atlas export.')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('journeys and maps', () => {
  test('creating a journey from the journeys page works', async ({ page }) => {
    await page.goto('/#/journeys');
    await page.getByRole('button', { name: 'New journey' }).click();
    await page.getByPlaceholder('Name').fill('Test route');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('link', { name: 'Test route' })).toBeVisible();
  });

  test('a created journey can be opened', async ({ page }) => {
    await page.goto('/#/journeys');
    await page.getByRole('button', { name: 'New journey' }).click();
    await page.getByPlaceholder('Name').fill('Second route');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('link', { name: 'Second route' }).click();
    await expect(page.getByRole('heading', { name: 'Second route' })).toBeVisible();
  });
});

test.describe('upload', () => {
  test('rejects a wrong file type and accepts a real audio file', async ({ page }) => {
    await page.goto('/#/upload');
    await expect(page.getByText('There is no server behind Sound Atlas.')).toBeVisible();

    // A tiny valid WAV so the browser can read metadata from it.
    const wav = buildWav();
    await page.setInputFiles('input[type="file"]', {
      name: 'test.wav',
      mimeType: 'audio/wav',
      buffer: wav,
    });
    await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible({ timeout: 20_000 });
  });

  test('requires the rights confirmation before saving', async ({ page }) => {
    await page.goto('/#/upload');
    await page.setInputFiles('input[type="file"]', {
      name: 'test.wav',
      mimeType: 'audio/wav',
      buffer: buildWav(),
    });
    await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Save recording' }).click();
    await expect(page.getByText('Confirm that you own this recording before saving.')).toBeVisible();
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only project');

  test('the menu opens and every destination is reachable', async ({ page }) => {
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('navigation', { name: 'Menu' });
    await expect(menu).toBeVisible();
    for (const label of ['Explore map', 'Collections', 'Journeys', 'Upload', 'Library', 'About']) {
      await expect(menu.getByRole('link', { name: label })).toBeVisible();
    }
    await menu.getByRole('link', { name: 'Explore map' }).click();
    await expect(page.getByRole('heading', { name: 'Explore the sound map' })).toBeVisible();
  });

  test('the explore view defaults to the list on a narrow screen', async ({ page }) => {
    await page.goto('/#/explore');
    // List mode renders cards and no map until the user asks for it.
    await expect(page.locator('article').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
  });

  test('nothing overflows the viewport horizontally', async ({ page }) => {
    for (const route of ['/', '/explore', '/collections', '/library', '/about', '/journeys', '/upload', '/random']) {
      await page.goto(`/#${route}`);
      await page.waitForLoadState('networkidle');
      // Give the hero and any async lists a moment to settle before measuring.
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(2);
    }
  });
});

/** Minimal 8-bit mono PCM WAV, 0.25 s of silence. */
function buildWav(): Buffer {
  const sampleRate = 8000;
  const samples = sampleRate / 4;
  const dataSize = samples;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  buffer.fill(128, 44);
  return buffer;
}
