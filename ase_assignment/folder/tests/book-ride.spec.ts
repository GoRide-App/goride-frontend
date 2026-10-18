import { test, expect } from '@playwright/test';

test('rider can book a tuk tuk ride and pay in cash', async ({ page }) => {
  test.setTimeout(90_000); // full ride simulation (request → driver → payment) exceeds the 30s default

  await test.step('Navigate to the ride booking flow', async () => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Home', description: 'Home' }).click();
  });

  await test.step('Search and select a destination', async () => {
    await page.getByRole('button', { name: 'Where to? Search a destination' }).click();
    await page.getByRole('button', { name: 'SLIIT Malabe Campus Malabe' }).click();
  });

  await test.step('View fare and choose Tuk Tuk', async () => {
    await page.getByRole('button', { name: 'See prices' }).click();
    await expect(page.getByRole('button', { name: /Choose Tuk Tuk/ })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Choose Tuk Tuk/ }).click();
  });

  await test.step('Request the ride and wait for driver assignment', async () => {
    await page.getByRole('button', { name: /Request Tuk Tuk/ }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: /driver has arrived/i })
    ).toBeVisible({ timeout: 30000 });
  });

  await test.step('Wait for the trip to complete and become payable', async () => {
    await expect(page.getByRole('button', { name: /Pay Rs [\d,]+ in cash/ })).toBeVisible({ timeout: 40000 });
  });

  await test.step('Pay in cash and complete the trip', async () => {
    await page.getByRole('button', { name: /Pay Rs [\d,]+ in cash/ }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page).toHaveURL(/\/rider$/);
  });
});