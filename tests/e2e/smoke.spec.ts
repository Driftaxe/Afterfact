import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Mayur/.gemini/antigravity-cli/brain/42d56a48-6341-45ec-8623-b4624b03e678';

test.describe('Root Application Landing Page & Visual Review', () => {
  test('serves the Afterfact root route and renders expected refined heading and CTA', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Clarity, even as facts change.');

    const description = page.getByText(/Check AI-generated answers against current web sources/i);
    await expect(description).toBeVisible();

    const textarea = page.locator('#answer-input');
    await expect(textarea).toBeVisible();

    const cta = page.getByRole('link', { name: 'View sample report' }).first();
    await expect(cta).toBeVisible();

    // Verify clicking CTA navigates to /report/demo?mode=fixture
    await cta.click();
    await expect(page).toHaveURL(/\/report\/demo/);

    expect(pageErrors).toEqual([]);
  });

  test('captures responsive screenshots and verifies zero overflow for landing page', async ({ page }) => {
    // 1. Desktop Dark
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('afterfact-theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForLoadState('networkidle');

    const overflowDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowDesktop).toBe(false);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'landing-desktop-dark.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'composer-desktop-dark.png'),
      fullPage: false,
    });

    // 2. Desktop Light
    const toggleToLight = page.getByRole('button', { name: /switch to light theme/i }).first();
    await expect(toggleToLight).toHaveAttribute('data-hydrated', 'true');
    await toggleToLight.click();
    await page.waitForTimeout(300);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'landing-desktop-light.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'composer-desktop-light.png'),
      fullPage: false,
    });

    // 3. Mobile Dark (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    const toggleToDark = page.getByRole('button', { name: /switch to dark theme/i }).first();
    await toggleToDark.click();
    await page.waitForTimeout(300);

    const overflowMobile = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowMobile).toBe(false);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'landing-mobile-dark.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'composer-mobile-dark.png'),
      fullPage: false,
    });

    // 4. Mobile Light (390px)
    const toggleToLightMobile = page.getByRole('button', { name: /switch to light theme/i }).first();
    await toggleToLightMobile.click();
    await page.waitForTimeout(300);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'landing-mobile-light.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'composer-mobile-light.png'),
      fullPage: false,
    });
  });
});
