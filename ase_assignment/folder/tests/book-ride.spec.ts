import { test, expect, devices, type Page } from '@playwright/test';

const driverAuthFile = 'playwright/.auth/driver.json';

/** The console's first GET /location/{driverId}: the backend status the page restores availability from. */
function isDriverLocationLoad(res: { url(): string; request(): { method(): string } }) {
  return res.request().method() === 'GET' && /^\/location\/[^/]+$/.test(new URL(res.url()).pathname);
}

/** Each driver trip stage (Current trip heading) and the footer action that advances it. */
const driverStages = [
  { heading: 'Head to the pickup point', action: "I've arrived" },
  { heading: 'Waiting at pickup', action: 'Start trip' },
  { heading: 'Trip in progress', action: 'Complete trip' },
];

/**
 * A run that died mid-trip leaves the driver "OnTrip" and unmatchable. The driver console offers
 * no cancel, so drive that trip through its remaining stages and dismiss it.
 */
async function clearLeftoverTrip(driver: Page) {
  const currentTrip = driver.getByRole('region', { name: 'Current trip' });
  const stageHeading = currentTrip.getByRole('heading', { level: 2 });
  await expect(stageHeading).toBeVisible({ timeout: 15000 });

  const headingText = await stageHeading.textContent();
  const current = driverStages.findIndex((stage) => stage.heading === headingText);
  for (const stage of current < 0 ? [] : driverStages.slice(current)) {
    await expect(currentTrip.getByRole('heading', { level: 2, name: stage.heading })).toBeVisible({ timeout: 15000 });
    await driver.getByRole('button', { name: stage.action }).click();
  }
  await expect(currentTrip.getByRole('heading', { level: 2, name: 'Trip completed' })).toBeVisible({ timeout: 15000 });
  await driver.getByRole('button', { name: 'Done' }).click();
  await expect(currentTrip).toBeHidden({ timeout: 15000 });
}

test('rider can book a tuk tuk ride and pay in cash', async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000); // two browsers drive the whole trip (online → request → accept → arrive → start → complete → pay)

  const driverContext = await browser.newContext({ ...devices['Desktop Chrome'], baseURL, storageState: driverAuthFile });
  const driver = await driverContext.newPage();

  try {
    await test.step('Driver: open the console and go online', async () => {
      const locationLoaded = driver.waitForResponse(isDriverLocationLoad);
      await driver.goto('/driver');
      const { status } = await (await locationLoaded).json();

      // dismissing a leftover trip leaves the console online
      if (status === 'OnTrip') await clearLeftoverTrip(driver);

      // Re-toggle a stale "Online" so availability and position are pushed fresh to the matcher.
      const goOffline = driver.getByRole('button', { name: 'Go offline' });
      const goOnline = driver.getByRole('button', { name: 'Go online' });
      if (status !== 'Offline') {
        await expect(goOffline).toBeEnabled({ timeout: 15000 });
        await goOffline.click();
      }
      await expect(goOnline).toBeEnabled({ timeout: 15000 });
      await goOnline.click();

      const availability = driver.getByRole('region', { name: 'Availability' });
      await expect(availability.getByRole('heading', { level: 2, name: "You're online" })).toBeVisible({ timeout: 15000 });
      await expect(driver.getByText('Listening for ride requests')).toBeVisible();
    });

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

    await test.step('Rider: request the ride', async () => {
      await page.getByRole('button', { name: /Request Tuk Tuk/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Finding your driver' })).toBeVisible({ timeout: 15000 });
    });

    await test.step('Driver: accept the incoming ride request', async () => {
      const offer = driver.getByRole('article', { name: 'New ride request' });
      await expect(offer).toBeVisible({ timeout: 45000 });
      await expect(offer.getByText('SLIIT Malabe Campus')).toBeVisible();
      await offer.getByRole('button', { name: 'Accept ride' }).click();

      const currentTrip = driver.getByRole('region', { name: 'Current trip' });
      await expect(currentTrip.getByRole('heading', { level: 2, name: 'Head to the pickup point' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Driver on the way' })).toBeVisible({ timeout: 15000 });
    });

    await test.step('Driver: mark arrived at the pickup', async () => {
      await driver.getByRole('button', { name: "I've arrived" }).click();
      await expect(driver.getByRole('region', { name: 'Current trip' }).getByRole('heading', { level: 2, name: 'Waiting at pickup' })).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole('heading', { level: 1, name: /driver has arrived/i })
      ).toBeVisible({ timeout: 30000 });
    });

    await test.step('Driver: start the trip', async () => {
      await driver.getByRole('button', { name: 'Start trip' }).click();
      await expect(driver.getByRole('region', { name: 'Current trip' }).getByRole('heading', { level: 2, name: 'Trip in progress' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Trip in progress' })).toBeVisible({ timeout: 15000 });
    });

    await test.step('Driver: complete the trip so it becomes payable', async () => {
      await driver.getByRole('button', { name: 'Complete trip' }).click();
      await expect(driver.getByRole('region', { name: 'Current trip' }).getByRole('heading', { level: 2, name: 'Trip completed' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: /Pay Rs [\d,]+ in cash/ })).toBeVisible({ timeout: 40000 });
    });

    await test.step('Pay in cash and complete the trip', async () => {
      await page.getByRole('button', { name: /Pay Rs [\d,]+ in cash/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Trip complete' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page).toHaveURL(/\/rider$/);
    });

    await test.step('Driver: finish the trip and go offline', async () => {
      await driver.getByRole('button', { name: 'Done' }).click();
      const availability = driver.getByRole('region', { name: 'Availability' });
      await expect(availability.getByRole('heading', { level: 2, name: "You're online" })).toBeVisible({ timeout: 15000 });
      await availability.getByRole('button', { name: 'Go offline' }).click();
      await expect(availability.getByRole('status')).toHaveText('Offline', { timeout: 15000 });
    });
  } finally {
    await driverContext.close();
  }
});
