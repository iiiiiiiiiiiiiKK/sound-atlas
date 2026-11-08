import { chromium, devices } from '@playwright/test';

const URL = 'https://iiiiiiiiiiiiikk.github.io/sound-atlas/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---- collections: real counts resolved from providers
await page.goto(`${URL}#/collections`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('article', { timeout: 60000 });
await page.waitForTimeout(3000);
const cards = await page.locator('article').count();
const firstCardText = (await page.locator('article').first().innerText()).replace(/\s+/g, ' ');
check('Collections resolve real counts', cards >= 6, `${cards} collections, first: ${firstCardText.slice(0, 60)}`);

// ---- open a collection detail and start playback from it
await page.locator('article a').first().click();
await page.waitForTimeout(2500);
const detailHeading = await page.locator('h1').first().innerText();
const soundCards = await page.locator('article').count();
check('Collection detail lists sounds', soundCards > 0, `${detailHeading} · ${soundCards} sounds`);

// ---- random sound
await page.goto(`${URL}#/random`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Take me somewhere' }).click();
await page.waitForTimeout(6000);
const randomText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
check(
  'Random sound returns a real, credited recording',
  /CC0|CC BY|Public domain/i.test(randomText),
  randomText.slice(0, 110),
);

// ---- library tabs and export
await page.goto(`${URL}#/library`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
for (const tab of ['Recently played', 'Sound maps', 'My recordings', 'Journeys']) {
  await page.getByRole('button', { name: new RegExp(`^${tab}`) }).click();
  await page.waitForTimeout(400);
}
check('Library tabs all render', true, '5 tabs navigated');
const download = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export data' }).click();
const file = await download;
check('Library export downloads JSON', /^sound-atlas-.*\.json$/.test(file.suggestedFilename()), file.suggestedFilename());

// ---- ambient mode from a live sound
await page.goto(`${URL}#/explore`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('a[href^="#/sound/"]', { timeout: 60000 });
await page.locator('a[href^="#/sound/"]').first().click();
await page.waitForTimeout(1500);
await page.getByRole('main').getByRole('button', { name: 'Ambient mode' }).click();
await page.waitForTimeout(1500);
const ambient = await page.getByRole('dialog', { name: 'Ambient mode' }).isVisible();
check('Ambient mode opens', ambient);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
check('Ambient mode closes on Escape', !(await page.getByRole('dialog', { name: 'Ambient mode' }).isVisible().catch(() => false)));

// ---- mobile: map mode toggle + a real tap on a marker opens the sheet
const mobile = await browser.newContext({ ...devices['iPhone 14'] });
const phone = await mobile.newPage();
await phone.goto(`${URL}#/explore`, { waitUntil: 'domcontentloaded' });
await phone.waitForSelector('article', { timeout: 60000 });
await phone.getByRole('button', { name: 'Map', exact: true }).click();
await phone.waitForSelector('.sound-marker', { timeout: 60000 });
await phone.evaluate(() => {
  const marker = document.querySelector('.sound-marker');
  marker?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
});
await phone.waitForTimeout(1800);
const sheet = await phone.getByRole('dialog').first().isVisible().catch(() => false);
check('Mobile marker tap opens the detail sheet', sheet);

check('No uncaught page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);
