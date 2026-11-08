import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Mayur/.gemini/antigravity-cli/brain/42d56a48-6341-45ec-8623-b4624b03e678';

test.describe('C01: Design Reference & Visual Foundation (/design)', () => {
  test('C01-01: Direct route navigation renders cleanly without console or page errors', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/design');
    expect(response?.status()).toBe(200);

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Afterfact — Design Reference');

    const sampleNotice = page.getByText(/design reference \/ sample content/i);
    await expect(sampleNotice.first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('C01-02: Defaults to dark mode on first visit with no stored preference', async ({
    page,
  }) => {
    await page.goto('/design');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveClass(/dark/);

    const toggle = page.getByRole('button', { name: /switch to light theme/i }).first();
    await expect(toggle).toBeVisible();
  });

  test('C01-02b: Corrupted or invalid stored preference falls back safely to dark mode', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('afterfact-theme', 'invalid-palette-xyz');
    });

    await page.goto('/design');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('C01-03: Theme toggle switches between dark and light, persists across reload, and updates accessible label', async ({
    page,
  }) => {
    await page.goto('/design');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Click toggle to switch to light
    const toggleToLight = page.getByRole('button', { name: 'Switch to light theme' }).first();
    await expect(toggleToLight).toHaveAttribute('data-hydrated', 'true');
    await toggleToLight.click();

    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(html).not.toHaveClass(/dark/);

    // Verify localStorage has persisted 'light'
    const storedTheme = await page.evaluate(() => localStorage.getItem('afterfact-theme'));
    expect(storedTheme).toBe('light');

    // Reload page and verify light theme persists
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Button label now describes next action: switch to dark
    const toggleToDark = page.getByRole('button', { name: 'Switch to dark theme' }).first();
    await expect(toggleToDark).toBeVisible();

    // Click again to toggle back to dark
    await toggleToDark.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const storedThemeDark = await page.evaluate(() => localStorage.getItem('afterfact-theme'));
    expect(storedThemeDark).toBe('dark');
  });

  test('C01-05: Storage failure resilience (throwing localStorage still renders and toggles)', async ({
    page,
  }) => {
    // Intercept localStorage methods to throw an error simulating incognito blocked storage
    await page.addInitScript(() => {
      window.Storage.prototype.getItem = () => {
        throw new Error('Access denied (SecurityError)');
      };
      window.Storage.prototype.setItem = () => {
        throw new Error('Access denied (SecurityError)');
      };
    });

    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/design');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    const toggle = page.getByRole('button', { name: /switch to light theme/i }).first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('data-hydrated', 'true');
    await toggle.click();

    await expect(html).toHaveAttribute('data-theme', 'light');
    expect(pageErrors).toEqual([]);
  });

  test('C01-07: Interactive local demo form validates, displays accessible errors, confirms, and resets', async ({
    page,
  }) => {
    await page.goto('/design');

    // Clear input to trigger validation error
    const input = page.getByLabel(/question or topic title/i);
    await input.fill('');

    const submitBtn = page.getByRole('button', { name: /validate & submit demo/i });
    await submitBtn.click();

    // Verify accessible error message is displayed
    const errorMessage = page.getByRole('alert').filter({ hasText: /title is required/i });
    await expect(errorMessage).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    // Enter valid title
    await input.fill('Valid Question Test Subject');
    await submitBtn.click();

    // Verify confirmation status
    const successBanner = page.getByRole('status');
    await expect(successBanner).toContainText(/form validated cleanly in local memory/i);

    // Reset form
    const resetBtn = page.getByRole('button', { name: /reset form/i });
    await resetBtn.click();
    await expect(successBanner).not.toBeVisible();
  });

  test('C01-07b: Interactive claim card expansion, loading state, and retry simulation', async ({
    page,
  }) => {
    await page.goto('/design');

    // Expand/collapse claim
    const expandBtn = page.getByRole('button', { name: /collapse details/i });
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    const expandBtnAfter = page.getByRole('button', { name: /expand details/i });
    await expect(expandBtnAfter).toBeVisible();
    await expandBtnAfter.click();
    await expect(page.getByText(/change timeline/i)).toBeVisible();

    // Trigger button loading test
    const triggerLoadingBtn = page.getByRole('button', { name: /trigger loading state/i });
    await triggerLoadingBtn.click();
    await expect(page.getByText(/click count:\s*1/i)).toBeVisible();

    // Interactive retry simulation
    const retryBtn = page.getByRole('button', { name: /simulate retry/i });
    await retryBtn.click();
    await expect(page.getByText(/reconnecting to simulated endpoint/i)).toBeVisible();
    await expect(page.getByText(/connection restored/i)).toBeVisible({ timeout: 5000 });
  });

  test('C01-08: All six verification statuses are visually rendered with distinct labels and icons', async ({
    page,
  }) => {
    await page.goto('/design');

    const statuses = [
      'Supported',
      'Outdated',
      'Contradicted',
      'Unresolved',
      'Checking',
      'Awaiting Clarification',
    ];

    for (const status of statuses) {
      const badge = page.getByText(status, { exact: true });
      await expect(badge.first()).toBeVisible();
    }
  });

  test('C01-10: Responsive layout review & screenshot generation (Desktop 1440px & Mobile 390px)', async ({
    page,
  }) => {
    // 1. Desktop Dark Mode (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design');
    await page.evaluate(() => {
      window.localStorage.setItem('afterfact-theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForLoadState('networkidle');

    // Assert zero page-level horizontal overflow
    const hasHorizontalOverflowDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflowDesktop).toBe(false);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'desktop-dark.png'),
      fullPage: false,
    });

    // 2. Desktop Light Mode (1440x900)
    const toggle = page.getByRole('button', { name: 'Switch to light theme' }).first();
    await expect(toggle).toHaveAttribute('data-hydrated', 'true');
    await toggle.click();
    await page.waitForTimeout(300);

    const issueText = await page.evaluate(() => {
      const portal = document.querySelector('nextjs-portal');
      const text = portal?.shadowRoot?.textContent;
      // Remove dev tool overlay for pristine visual screenshot
      portal?.remove();
      return text;
    });
    console.log('DEV OVERLAY TEXT ON LIGHT TOGGLE:', issueText);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'desktop-light.png'),
      fullPage: false,
    });

    // 3. Tablet Viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    const hasHorizontalOverflowTablet = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflowTablet).toBe(false);

    // 4. Mobile Dark Mode (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    const toggleToDark = page.getByRole('button', { name: 'Switch to dark theme' }).first();
    await toggleToDark.click();
    await page.waitForTimeout(300);

    const hasHorizontalOverflowMobile = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflowMobile).toBe(false);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'mobile-dark.png'),
      fullPage: false,
    });

    // 5. Mobile Light Mode (390x844)
    const toggleToLightMobile = page.getByRole('button', { name: 'Switch to light theme' }).first();
    await toggleToLightMobile.click();
    await page.waitForTimeout(300);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'mobile-light.png'),
      fullPage: false,
    });
  });
});
