import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/driver.json';

setup('authenticate as driver', async ({ page }) => {
  setup.setTimeout(60_000); // Asgardeo login plus a cold dashboard load can exceed the 30s default

  // --- this part now runs on Asgardeo's domain ---

  await page.goto('https://goride-demo.vercel.app/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  // Filling before the Asgardeo form has finished loading can submit a stale value ("Login failed!")
  await page.waitForURL(/accounts\.asgardeo\.io/, { waitUntil: 'load' });
  const username = page.getByTestId('login-page-username-input');
  const password = page.getByTestId('login-page-password-input');
  await username.fill(process.env.DRIVER_TEST_USER!);
  await password.fill(process.env.DRIVER_TEST_PASS!);
  // compare as booleans so a failure never prints the credentials
  await expect.poll(async () => (await username.inputValue()) === process.env.DRIVER_TEST_USER, { message: 'username input holds DRIVER_TEST_USER' }).toBe(true);
  await expect.poll(async () => (await password.inputValue()) === process.env.DRIVER_TEST_PASS, { message: 'password input holds DRIVER_TEST_PASS' }).toBe(true);
  await expect(page.getByTestId('login-page-continue-login-button')).toBeEnabled();
  await page.getByTestId('login-page-continue-login-button').click();
  // --------------------------------------------------------------

  // Let the OIDC redirect chain (Asgardeo → callback → dashboard) finish on its own
  await page.waitForURL(/dashboard/, { timeout: 15000 });

  // back on the app, confirm login succeeded and the account really is a driver
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('link', { name: /Open the driver console/ })).toBeVisible({ timeout: 20000 });

  // save the resulting session cookie to a file
  await page.context().storageState({ path: authFile });
});
