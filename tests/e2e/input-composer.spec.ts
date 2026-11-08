import { test, expect } from '@playwright/test';

test.describe('C02 Input Composer Interactive Experience (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('C02-02: Enforces validation on empty and whitespace-only inputs', async ({ page }) => {
    const verifyButton = page.getByRole('button', { name: 'Verify answer' });
    await expect(verifyButton).toBeVisible();

    // 1. Submit empty input
    await verifyButton.click();
    const errorNotice = page.locator('#answer-input-err');
    await expect(errorNotice).toBeVisible();
    await expect(errorNotice).toContainText('cannot be empty or whitespace-only');

    // 2. Submit whitespace-only input
    const textarea = page.locator('#answer-input');
    await textarea.fill('   \n\t   ');
    await verifyButton.click();
    await expect(errorNotice).toBeVisible();
    await expect(errorNotice).toContainText('cannot be empty or whitespace-only');
  });

  test('C02-02b: Character counter updates live and preserves typed whitespace/Unicode', async ({ page }) => {
    const textarea = page.locator('#answer-input');
    const inputWithUnicode = '🚀 Fact: Claude Pro is $20/month.   \n\nPreserve spaces.';
    await textarea.fill(inputWithUnicode);

    const charCount = page.locator('#answer-input-count');
    await expect(charCount).toBeVisible();
    await expect(charCount).toContainText(`${inputWithUnicode.length} / 8000`);

    // Ensure raw value is byte-for-byte preserved without auto-trimming
    const val = await textarea.inputValue();
    expect(val).toBe(inputWithUnicode);
  });

  test('C02-02c: Try sample input populates textarea and context, Clear resets it', async ({ page }) => {
    const sampleButton = page.getByRole('button', { name: 'Try sample input' });
    await sampleButton.click();

    const textarea = page.locator('#answer-input');
    const val = await textarea.inputValue();
    expect(val).toContain('Anthropic Claude Pro costs $20 per month');

    // Context accordion can be toggled to verify sample values populated
    const contextToggle = page.getByRole('button', { name: /Add context/i });
    await contextToggle.click();

    const targetDateField = page.getByPlaceholder('e.g. 2024-09-01');
    await expect(targetDateField).toHaveValue('2024-09-01');

    // Click Clear
    const clearButton = page.getByRole('button', { name: 'Clear' });
    await clearButton.click();
    await expect(textarea).toHaveValue('');
  });

  test('C02-03: Arbitrary input submission shows honest not-connected notice, never a fake report', async ({ page }) => {
    const textarea = page.locator('#answer-input');
    await textarea.fill('Custom text that is not in any database.');

    const verifyButton = page.getByRole('button', { name: 'Verify answer' });
    await verifyButton.click();

    // Verify honest notice appears without URL change or fake report display
    const notice = page.getByText(/Live verification isn[’']t available yet/i);
    await expect(notice).toBeVisible();
    await expect(page).toHaveURL('/');

    // Verify sample report action remains distinct and leads to /report/demo?mode=fixture
    const sampleLink = page.getByRole('link', { name: 'View sample report' }).first();
    await expect(sampleLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/report\/demo/),
      sampleLink.click(),
    ]);
  });

  test('C02-03b: Progressive disclosure context preserves values across expand/collapse', async ({ page }) => {
    const contextToggle = page.getByRole('button', { name: /Add context/i });
    await contextToggle.click();

    const versionField = page.getByPlaceholder('e.g. v2, 2024-05');
    await versionField.fill('2024-11');

    // Collapse
    await contextToggle.click();
    await expect(versionField).not.toBeVisible();

    // Re-expand and assert value preserved
    await contextToggle.click();
    await expect(versionField).toBeVisible();
    await expect(versionField).toHaveValue('2024-11');
  });

  test('C02-03c: Ask Question mode switches tabs and enforces 800 character limit', async ({ page }) => {
    const askTab = page.getByRole('tab', { name: /Ask question/i });
    await askTab.click();

    const askTextarea = page.locator('#ask-input');
    await expect(askTextarea).toBeVisible();

    const charCount = page.locator('#ask-input-count');
    await expect(charCount).toContainText('0 / 800');

    // Submit empty ask
    const submitButton = page.getByRole('button', { name: 'Submit question' });
    await submitButton.click();

    const askError = page.locator('#ask-input-err');
    await expect(askError).toBeVisible();
    await expect(askError).toContainText('cannot be empty or whitespace-only');
  });
});
