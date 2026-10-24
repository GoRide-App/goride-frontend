import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/rider.json';

setup('authenticate as rider', async ({ page }) => {

  // --- this part now runs on Asgardeo's domain, not localhost:3000 ---

  await page.goto('https://goride-demo.vercel.app/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByTestId('login-page-username-input').click();
  await page.getByTestId('login-page-username-input').fill(process.env.RIDER_TEST_USER!);
  await page.getByTestId('login-page-password-input').click();
  await page.getByTestId('login-page-password-input').fill(process.env.RIDER_TEST_PASS!);
  await page.waitForTimeout(1500);
  await page.getByTestId('login-page-continue-login-button').click();
  // --------------------------------------------------------------
  
  // Let the OIDC redirect chain (Asgardeo → callback → dashboard) finish on its own
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  
  // back on your app, confirm login actually succeeded
  await expect(page).toHaveURL(/dashboard/);

  // save the resulting session cookie to a file
  await page.context().storageState({ path: authFile });
});