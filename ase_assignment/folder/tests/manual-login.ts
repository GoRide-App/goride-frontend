import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false }); // must be headed — you need to see the captcha
  const page = await browser.newPage();

  await page.goto('https://goride-demo.vercel.app/login');
  await page.getByRole('button', { name: 'Sign in' }).click();

  console.log('>>> Solve the CAPTCHA and log in manually in the browser window that just opened.');
  console.log('>>> Waiting up to 2 minutes for you to finish...');

  await page.waitForURL(/dashboard/, { timeout: 120_000 });
  await page.context().storageState({ path: 'playwright/.auth/rider.json' });

  console.log('✅ Session saved to playwright/.auth/rider.json');
  await browser.close();
})();