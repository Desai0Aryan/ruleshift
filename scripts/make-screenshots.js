// Draft App Store screenshots rendered from the browser preview (same engine + layout, NOT the native renderer).
// Replace with real device captures before submission. Run: node scripts/make-screenshots.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'docs', 'appstore', 'screenshots', 'raw');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: false });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(__dirname, '..', 'web-preview', 'dist', 'index.html'));
  await page.evaluate(() => { try { localStorage.setItem('rs.solved', JSON.stringify(['L01','L02','L03','L04','L05'])); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/1-home.png' });
  await page.evaluate(() => window.__rs.start('L07'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__rs.solveAuto(); });
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/2-build.png' });
  await page.click('#goBtn');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/3-roll.png' });
  await page.waitForSelector('.rule:not([disabled])', { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/4-twist.png' });
  const rules = await page.$$('.rule:not([disabled])');
  await rules[0].click();
  await page.waitForSelector('#watch', { state: 'visible', timeout: 20000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/5-send.png' });
  await page.click('#watch');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: OUT + '/6-replay.png' });
  await b.close();
})();
