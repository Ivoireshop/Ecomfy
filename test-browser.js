import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Navigating...');
  await page.goto('http://localhost:8081/studio', { waitUntil: 'networkidle' });
  console.log('Done.');
  
  await browser.close();
})();
