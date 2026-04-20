import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4173/chat', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const pane = document.querySelector('.inspector-pane');
  if (pane) pane.scrollTop = pane.scrollHeight;
});
await page.screenshot({ path: '/opt/Agent/runtime/ui-inspector-bottom.png', fullPage: false });
await browser.close();
