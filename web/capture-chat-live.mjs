import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4173/chat/09222190-3b69-4e44-a7c0-6b5f1bd8c09a', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/opt/Agent/runtime/ui-chat-live.png', fullPage: false });
await browser.close();
