/**
 * Captures the real UI for the README (docs/screenshots).
 *
 * Runs against the built site in `dist/` served by `vite preview`, so the images show the
 * production artefact — not a mock. Desktop and mobile viewports are both captured.
 *
 * Usage: node scripts/screenshots.mjs   (requires a running preview server)
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:4319';
const OUT = resolve(process.cwd(), 'docs/screenshots');

const SHOTS = [
  { name: 'home', path: '/', ready: 'h1' },
  { name: 'explore', path: '/explore', ready: '.leaflet-container', map: true },
  { name: 'collections', path: '/collections', ready: 'article' },
  { name: 'library', path: '/library', ready: 'h1' },
  { name: 'upload', path: '/upload', ready: 'h1' },
  { name: 'about', path: '/about', ready: 'h1' },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  // ---- desktop
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await desktop.newPage();
  for (const shot of SHOTS) {
    await page.goto(`${BASE}/#${shot.path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(shot.ready, { timeout: 45_000 }).catch(() => undefined);
    if (shot.map) {
      await page.getByRole('button', { name: 'Map', exact: true }).click().catch(() => undefined);
      await page.waitForSelector('.sound-marker', { timeout: 45_000 }).catch(() => undefined);
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${shot.name}.png` });
    console.log(`desktop ${shot.name} → docs/screenshots/${shot.name}.png`);
  }

  // ---- a sound detail panel, opened from the map list
  await page.goto(`${BASE}/#/explore`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sound-marker', { timeout: 45_000 }).catch(() => undefined);
  const card = page.locator('a[href^="#/sound/"]').first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/sound-detail.png` });
    console.log('desktop sound-detail → docs/screenshots/sound-detail.png');
  }

  // ---- light theme home
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Switch to light theme' }).click().catch(() => undefined);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/home-light.png` });
  console.log('desktop home-light → docs/screenshots/home-light.png');

  await desktop.close();

  // ---- mobile
  const mobile = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 3, colorScheme: 'dark' });
  const phone = await mobile.newPage();
  for (const shot of [
    { name: 'mobile-home', path: '/' },
    { name: 'mobile-explore', path: '/explore' },
    { name: 'mobile-collections', path: '/collections' },
  ]) {
    await phone.goto(`${BASE}/#${shot.path}`, { waitUntil: 'networkidle' });
    await phone.waitForTimeout(1600);
    await phone.screenshot({ path: `${OUT}/${shot.name}.png` });
    console.log(`mobile ${shot.name} → docs/screenshots/${shot.name}.png`);
  }

  await mobile.close();
  await browser.close();
  console.log('\nDone.');
}

await main();
