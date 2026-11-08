import { chromium, devices } from '@playwright/test';

const BASE = 'http://127.0.0.1:4319';
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 14'] });
const page = await context.newPage();

const routes = ['/', '/explore', '/collections', '/collections/rain', '/library', '/journeys', '/upload', '/about', '/random'];

for (const route of routes) {
  await page.goto(`${BASE}/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3200);
  const info = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    for (const el of document.querySelectorAll('main *')) {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1 && !el.closest('svg')) {
        bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), right: Math.round(rect.right) });
      }
    }
    return { vw, scrollW: document.documentElement.scrollWidth, bad: bad.slice(0, 4) };
  });
  const status = info.scrollW - info.vw <= 2 ? 'OK ' : 'BAD';
  console.log(status, route, `scrollW=${info.scrollW} vw=${info.vw}`);
  if (status === 'BAD') for (const item of info.bad) console.log('     ', JSON.stringify(item));
}

// A sound detail page needs a real id: take it from the map list.
await page.goto(`${BASE}/#/explore`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('a[href^="#/sound/"]', { timeout: 60000 });
const href = await page.locator('a[href^="#/sound/"]').first().getAttribute('href');
await page.goto(`${BASE}/${href}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const detail = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  vw: document.documentElement.clientWidth,
}));
console.log(detail.scrollW - detail.vw <= 2 ? 'OK ' : 'BAD', '/sound/:id', JSON.stringify(detail));

await browser.close();
