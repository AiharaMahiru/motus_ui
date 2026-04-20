import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const targetUrl = process.argv[2] || 'http://127.0.0.1:4173/chat';
const outputPath = process.argv[3] || '/opt/Agent/runtime/ui-analysis-1080p.png';
console.log(`Navigating to: ${targetUrl} (1920x1080)`);
try {
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000); // Give blurs and animations more time to settle
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`Screenshot saved to: ${outputPath}`);
} catch (error) {
  console.error(`Failed to capture screenshot: ${error.message}`);
} finally {
  await browser.close();
}
