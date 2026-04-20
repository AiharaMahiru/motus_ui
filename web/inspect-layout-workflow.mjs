import { chromium } from '@playwright/test';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:4173/workflows', { waitUntil: 'networkidle' });
const result = await page.evaluate(() => ({
  viewport: { width: window.innerWidth, height: window.innerHeight },
  doc: { scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight },
  grid: (() => { const r = document.querySelector('.workspace-grid')?.getBoundingClientRect(); return r ? { height: r.height, bottom: r.bottom, top: r.top } : null; })(),
  inspector: (() => { const el = document.querySelector('.workspace-inspector'); const r = el?.getBoundingClientRect(); return r && el ? { height: r.height, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight } : null; })()
}));
console.log(JSON.stringify(result, null, 2));
await browser.close();
