import { chromium } from '@playwright/test';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:4173/chat', { waitUntil: 'networkidle' });
const result = await page.evaluate(() => {
  const qs = (s) => document.querySelector(s);
  const getBox = (s) => {
    const el = qs(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top:r.top, left:r.left, width:r.width, height:r.height, bottom:r.bottom, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  };
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    doc: { scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight, bodyScrollHeight: document.body.scrollHeight },
    appShell: getBox('.app-shell'),
    appHeader: getBox('.app-header'),
    appMain: getBox('.app-main'),
    workspaceGrid: getBox('.workspace-grid'),
    workspaceSidebar: getBox('.workspace-sidebar'),
    workspaceMain: getBox('.workspace-main'),
    workspaceInspector: getBox('.workspace-inspector'),
    mainPanel: getBox('.main-panel'),
    chatScrollRegion: getBox('.chat-scroll-region'),
    composerPanel: getBox('.composer-panel')
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
