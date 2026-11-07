import { test, expect } from '@playwright/test';

test.describe('Root Application Smoke Check', () => {
  test('serves the Afterfact root route and renders expected heading without page errors', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Afterfact');

    const statusNotice = page.getByText(/under construction/i);
    await expect(statusNotice).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
