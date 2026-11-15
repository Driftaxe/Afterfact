import { test, expect } from '@playwright/test';

test.describe('Hero Refinements Verification', () => {
  test('verifies headline centering, smaller lower buttons, no move-to-reveal, no circle glitch, and elegant baseline bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Headline is present and centered
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Every claim has a story.');
    await expect(h1).toBeVisible();

    // 2. Ensure "MOVE TO REVEAL" does NOT exist
    const moveHint = page.getByText(/move to reveal/i);
    await expect(moveHint).toHaveCount(0);

    // 3. Ensure "01 // TRACE THE CLAIM" and "03 // TRACK WHAT CHANGES" are removed
    await expect(page.getByText('TRACE THE CLAIM')).toHaveCount(0);
    await expect(page.getByText('INSPECT THE EVIDENCE')).toHaveCount(0);
    await expect(page.getByText('TRACK WHAT CHANGES')).toHaveCount(0);

    // 4. Ensure no circle cursor at top of website when moving mouse over headline
    const headlineBox = await h1.boundingBox();
    expect(headlineBox).not.toBeNull();
    if (headlineBox) {
      // Move mouse across the headline
      await page.mouse.move(headlineBox.x + 50, headlineBox.y + 20);
      await page.mouse.move(headlineBox.x + 200, headlineBox.y + 20);
      await page.mouse.move(headlineBox.x + 400, headlineBox.y + 20);

      // Verify no stray fixed element exists near top (y < 40) with border-radius 50%
      const strayCircles = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('div'));
        return els.filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return (
            style.borderRadius.includes('9999px') ||
            style.borderRadius.includes('50%') ||
            el.className.includes('rounded-full')
          ) && rect.top >= 0 && rect.top < 40 && rect.width > 15 && rect.width < 40 && style.position === 'fixed';
        }).length;
      });
      expect(strayCircles).toBe(0);
    }

    // 5. Buttons: Verify they are micro-compact and positioned below headline
    const verifyBtn = page.getByRole('link', { name: /verify an answer/i }).first();
    const sampleBtn = page.getByRole('link', { name: /view sample report/i }).first();
    await expect(verifyBtn).toBeVisible();
    await expect(sampleBtn).toBeVisible();

    const verifyBox = await verifyBtn.boundingBox();
    expect(verifyBox).not.toBeNull();
    if (verifyBox && headlineBox) {
      // Verify buttons are significantly lower than headline (at least 40px below headline bottom)
      expect(verifyBox.y - (headlineBox.y + headlineBox.height)).toBeGreaterThan(40);
      // Verify button height is ultra-compact (< 34px)
      expect(verifyBox.height).toBeLessThan(34);
    }

    // 6. Baseline bar: Protocol identity removed, Signature & Explore Story anchor present
    await expect(page.getByText('SYS // TEMPORAL EVIDENCE PROTOCOL')).toHaveCount(0);
    await expect(page.getByText('Clarity, even as facts change.')).toBeVisible();
    const exploreStory = page.getByRole('link', { name: /explore story/i });
    await expect(exploreStory).toBeVisible();
    await expect(exploreStory).toHaveAttribute('href', '#product');
  });
});
