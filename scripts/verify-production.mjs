/**
 * Production verification against the deployed site.
 *
 * Checks the things that can only be true of the real deployment: the served HTML, the
 * catalogue actually being reachable, real map tiles, a real audio request, and mobile
 * layout at 390 px. Fails loudly rather than printing a green summary it did not measure.
 *
 * Usage: node scripts/verify-production.mjs [url]
 */
import { chromium, devices } from '@playwright/test';

const URL = process.argv[2] || process.env.PROD_URL || 'https://iiiiiiiiiiiiikk.github.io/sound-atlas/';
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();

try {
  // ------------------------------------------------------------ desktop
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(URL, { waitUntil: 'domcontentloaded' });
  record('Home responds 200', response?.status() === 200, `HTTP ${response?.status()}`);

  await page.waitForSelector('h1', { timeout: 60_000 });
  const heading = (await page.locator('h1').first().innerText()).replace(/\s+/g, ' ').trim();
  record('Hero heading renders', heading.includes('SOUND'), heading);

  const authorHref = await page.getByRole('link', { name: 'Author on X' }).first().getAttribute('href');
  record('Author link points at X', authorHref === 'https://x.com/0xkillcoin', authorHref ?? 'missing');

  // The stat only becomes a number once the bundled catalogue loaded.
  await page.waitForFunction(
    () => {
      const first = document.querySelector('dd');
      return first && first.textContent && first.textContent.trim() !== '—';
    },
    { timeout: 45_000 },
  );
  const stat = (await page.locator('dd').first().innerText()).trim();
  record('Catalogue loaded (recording count)', Number(stat.replace(/,/g, '')) > 0, stat);

  // --------------------------------------------------------------- map
  await page.goto(`${URL}#/explore`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sound-marker', { timeout: 60_000 });
  await page.waitForTimeout(4000);
  const markerCount = await page.locator('.sound-marker').count();
  const tileCount = await page.locator('.leaflet-tile-loaded').count();
  record('Map markers drawn', markerCount > 0, `${markerCount} clusters`);
  record('Basemap tiles loaded', tileCount > 0, `${tileCount} tiles`);
  const showing = (await page.locator('body').innerText()).match(/Showing[^\n]*/)?.[0];
  record('Result count shown', Boolean(showing), showing ?? 'missing');

  // --------------------------------------------------------- real audio
  await page.locator('a[href^="#/sound/"]').first().click();
  await page.waitForTimeout(1200);
  const archiveRequest = page.waitForRequest(
    (request) => /^https:\/\/(upload\.wikimedia\.org|static\.inaturalist\.org)\//.test(request.url()),
    { timeout: 45_000 },
  );
  await page.getByRole('main').getByRole('button', { name: 'Play' }).first().click();
  const audio = await archiveRequest;
  record('Playback requests a real archive file', true, audio.url().slice(0, 72) + '…');

  const playing = await page
    .getByRole('main')
    .getByRole('button', { name: 'Pause' })
    .first()
    .waitFor({ timeout: 40_000 })
    .then(() => true)
    .catch(() => false);
  record('Player reaches the playing state', playing);

  record('No uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

  // -------------------------------------------------------------- mobile
  const mobileContext = await browser.newContext({ ...devices['iPhone 14'] });
  const phone = await mobileContext.newPage();
  for (const route of ['/', '/explore', '/collections', '/library', '/about']) {
    await phone.goto(`${URL}#${route}`, { waitUntil: 'domcontentloaded' });
    await phone.waitForTimeout(1500);
    const overflow = await phone.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    record(`No horizontal overflow on ${route}`, overflow <= 2, `${overflow}px`);
  }

  await phone.goto(`${URL}#/`, { waitUntil: 'domcontentloaded' });
  await phone.waitForSelector('h1', { timeout: 45_000 });
  await phone.getByRole('button', { name: 'Menu' }).click();
  const menuLinks = await phone.getByRole('navigation', { name: 'Menu' }).getByRole('link').count();
  record('Mobile menu exposes every destination', menuLinks === 6, `${menuLinks} links`);
} finally {
  await browser.close();
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.error('Failed checks:', failed.map((entry) => entry.name).join(', '));
  process.exit(1);
}
