import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Mayur/.gemini/antigravity-cli/brain/42d56a48-6341-45ec-8623-b4624b03e678';

test.describe('C02 Interactive Report Experience (/report/[id])', () => {
  test('C02-04: Direct sample route loads cleanly with visible replay label and reload persistence', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const response = await page.goto('/report/demo?mode=fixture');
    expect(response?.status()).toBe(200);

    // Verify prominent replay labeling
    const replayBadge = page.getByText(/Sample report · Not a live verification/i);
    await expect(replayBadge).toBeVisible();

    // Verify run ID
    const runId = page.getByText('run_golden_fixture_mixed_001');
    await expect(runId).toBeVisible();

    // Reload page and assert report persists without errors
    await page.reload();
    await expect(replayBadge).toBeVisible();
    await expect(runId).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('C02-04b: Unknown report ID honestly renders not-found error state, never fabricating a report', async ({ page }) => {
    await page.goto('/report/unknown_test_id_9999');
    await page.waitForLoadState('networkidle');

    const errorTitle = page.getByRole('heading', { name: 'Report Not Found' });
    await expect(errorTitle).toBeVisible();

    const errorMessage = page.getByText(/Report 'unknown_test_id_9999' not found/i);
    await expect(errorMessage).toBeVisible();

    // Return to input button works
    const returnLink = page.getByRole('link', { name: 'Return to Input' });
    await expect(returnLink).toBeVisible();

    // Load sample report button works
    const sampleLink = page.getByRole('link', { name: 'Load Sample Report' });
    await expect(sampleLink).toBeVisible();
  });

  test('C02-05: Summary counts and verdicts match canonical parsed golden fixture', async ({ page }) => {
    await page.goto('/report/demo?mode=fixture');
    await page.waitForLoadState('networkidle');

    // Summary bar checks
    await expect(page.getByRole('button', { name: /All Claims 5/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Supported 2/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Outdated 1/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Contradicted 1/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Unresolved 1/i })).toBeVisible();

    // Filtering by 'Outdated' filters claim list to 1 claim
    const outdatedFilter = page.getByRole('button', { name: /Outdated 1/i });
    await outdatedFilter.click();
    await expect(page.getByText('Claims (1 of 5)')).toBeVisible();
    await expect(
      page
        .getByRole('listbox', { name: 'Extracted claim statements' })
        .getByText(/Parag Agrawal is the current CEO of Twitter/i)
    ).toBeVisible();

    // Reset filter
    const allFilter = page.getByRole('button', { name: /All Claims 5/i });
    await allFilter.click();
    await expect(page.getByText('Claims (5 of 5)')).toBeVisible();
  });

  test('C02-06: Interactive claim selection synchronizes answer highlight, list, and detail panel', async ({ page }) => {
    await page.goto('/report/demo?mode=fixture');
    await page.waitForLoadState('networkidle');

    // Claim 1 is selected by default
    const firstHighlight = page.getByRole('button', {
      name: /Anthropic Claude Pro costs \$20 per month/i,
    });
    await expect(firstHighlight).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Freshness score reflects the verification rubric, not a probability.')).toBeVisible();

    // 1. Click highlight for claim 4 (Twitter CEO)
    const fourthHighlight = page.getByRole('button', {
      name: /Parag Agrawal is the current CEO of Twitter/i,
    });
    await fourthHighlight.click();

    // Assert highlight gets selected
    await expect(fourthHighlight).toHaveAttribute('aria-pressed', 'true');
    await expect(firstHighlight).toHaveAttribute('aria-pressed', 'false');

    // Assert detail panel updates to claim 4 (Outdated, Score 0, Timeline, Correction)
    await expect(page.getByText('SUPERSEDED_HISTORICAL_CLAIM')).toBeVisible();
    await expect(page.getByText('Linda Yaccarino is the CEO of X (formerly Twitter)')).toBeVisible();
    await expect(page.getByText('Twitter announces Parag Agrawal as Chief Executive Officer')).toBeVisible();

    // 2. Click claim list item for claim 2 (Stripe)
    const stripeListItem = page.getByText(/Stripe's payment intent requires specifying/i).first();
    await stripeListItem.click();

    // Assert Stripe claim is now selected in highlight and detail panel
    const stripeHighlight = page.getByRole('button', {
      name: /Stripe's payment intent requires specifying/i,
    });
    await expect(stripeHighlight).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('DECISIVE_CONTRADICTION')).toBeVisible();
    await expect(page.getByText(/We recommend using automatic_payment_methods/i)).toBeVisible();
  });

  test('C02-08: Evidence cards render distinct dates, passage quotes, and safe links', async ({ page }) => {
    await page.goto('/report/demo?mode=fixture');
    await page.waitForLoadState('networkidle');

    // Select Stripe claim
    const stripeHighlight = page.getByRole('button', {
      name: /Stripe's payment intent requires specifying/i,
    });
    await stripeHighlight.click();

    // Check evidence card elements
    const evidenceSection = page.locator('article[aria-label*="Stripe API Documentation"]');
    await expect(evidenceSection).toBeVisible();

    // Distinct dates
    await expect(evidenceSection.getByText('Published: 2024-05-15')).toBeVisible();
    await expect(evidenceSection.getByText('Effective: 2024-05-15')).toBeVisible();
    await expect(evidenceSection.getByText('Retrieved: 2024-09-01')).toBeVisible();

    // Safe external link
    const sourceLink = evidenceSection.getByRole('link', { name: /Verify source/i });
    await expect(sourceLink).toHaveAttribute('target', '_blank');
    await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(sourceLink).toHaveAttribute('href', 'https://docs.stripe.com/payments/payment-intents');
  });

  test('C02-10 & C02-11: Responsive layout, zero horizontal overflow, and screenshot generation', async ({ page }) => {
    // 1. Desktop Dark (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/report/demo?mode=fixture');
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
      path: path.join(ARTIFACT_DIR, 'report-desktop-dark.png'),
      fullPage: false,
    });

    // 2. Desktop Light
    const toggleToLight = page.getByRole('button', { name: /switch to light theme/i }).first();
    await expect(toggleToLight).toHaveAttribute('data-hydrated', 'true');
    await toggleToLight.click();
    await page.waitForTimeout(300);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'report-desktop-light.png'),
      fullPage: false,
    });

    // 3. Tablet Layout (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    const overflowTablet = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowTablet).toBe(false);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'report-tablet-dark.png'),
      fullPage: false,
    });

    // 4. Mobile Dark (390x844)
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
      path: path.join(ARTIFACT_DIR, 'report-mobile-dark.png'),
      fullPage: false,
    });

    // 5. Mobile Light
    const toggleToLightMobile = page.getByRole('button', { name: /switch to light theme/i }).first();
    await toggleToLightMobile.click();
    await page.waitForTimeout(300);

    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'report-mobile-light.png'),
      fullPage: false,
    });
  });
});
