import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:4173/chat', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/opt/Agent/runtime/review-current-ui.png', fullPage: false });
await browser.close();
