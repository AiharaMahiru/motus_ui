import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const targetUrl = process.argv[2] || 'http://127.0.0.1:4173/chat';
const outputPath = process.argv[3] || '/opt/Agent/runtime/ui-analysis.png';
console.log(`Navigating to: ${targetUrl}`);
try {
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  // Wait a bit more for dynamic content/SSE if any initial data is loading
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`Screenshot saved to: ${outputPath}`);
} catch (error) {
  console.error(`Failed to capture screenshot: ${error.message}`);
} finally {
  await browser.close();
}
