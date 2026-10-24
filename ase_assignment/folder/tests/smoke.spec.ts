import { test, expect } from "@playwright/test";

test("dashboard loads after login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening),/i })).toBeVisible();
});
