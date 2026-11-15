import { test, expect } from '@playwright/test';

test.describe('Hero Refinements Verification', () => {
  test('verifies AFTERFACT title above, smaller stretched faded headline below, no wordmark fading, compact buttons, and baseline bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 0. Verify AFTERFACT wordmark opacity is at initial fade (0.46) and remains constant
    const initialWordmarkOpacity = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--hero-wordmark-opacity').trim();
    });
    expect(parseFloat(initialWordmarkOpacity)).toBeCloseTo(0.46, 2);

    // 1. Eyebrow and Description are removed, Headline is present
    await expect(page.getByText('TEMPORAL EVIDENCE INTELLIGENCE')).toHaveCount(0);
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Every claim has a story.');
    await expect(h1).toBeVisible();

    await expect(page.getByText(/Verify AI-generated answers against current sources/i)).toHaveCount(0);

    // 2. Ensure "MOVE TO REVEAL" does NOT exist
    const moveHint = page.getByText(/move to reveal/i);
    await expect(moveHint).toHaveCount(0);

    // 3. Ensure "01 // TRACE THE CLAIM" and "03 // TRACK WHAT CHANGES" are removed
    await expect(page.getByText('TRACE THE CLAIM')).toHaveCount(0);
    await expect(page.getByText('INSPECT THE EVIDENCE')).toHaveCount(0);
    await expect(page.getByText('TRACK WHAT CHANGES')).toHaveCount(0);

    // 4. Verify AFTERFACT TITLE is visible, oversized, and headline is positioned BELOW the TITLE
    const wordmark = page.locator('img.hero-wordmark');
    await expect(wordmark).toBeVisible();
    const wordmarkBox = await wordmark.boundingBox();
    const headlineBox = await h1.boundingBox();
    expect(wordmarkBox).not.toBeNull();
    expect(headlineBox).not.toBeNull();

    if (wordmarkBox && headlineBox) {
      // Headline is strictly below the AFTERFACT title
      expect(headlineBox.y).toBeGreaterThan(wordmarkBox.y);
      // Wordmark is oversized (> 1000px on 1440px viewport)
      expect(wordmarkBox.width).toBeGreaterThan(1000);
    }

    // 5. Move mouse over headline and verify no stray circle cursor at top
    if (headlineBox) {
      await page.mouse.move(headlineBox.x + 50, headlineBox.y + 10);
      await page.mouse.move(headlineBox.x + 200, headlineBox.y + 10);
      await page.mouse.move(headlineBox.x + 350, headlineBox.y + 10);

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

    // 6. Buttons: Verify they are micro-compact and positioned below headline
    const verifyBtn = page.getByRole('link', { name: /verify an answer/i }).first();
    const sampleBtn = page.getByRole('link', { name: /view sample report/i }).first();
    await expect(verifyBtn).toBeVisible();
    await expect(sampleBtn).toBeVisible();

    const verifyBox = await verifyBtn.boundingBox();
    expect(verifyBox).not.toBeNull();
    if (verifyBox && headlineBox) {
      expect(verifyBox.y - (headlineBox.y + headlineBox.height)).toBeGreaterThan(20);
      expect(verifyBox.height).toBeLessThan(40);
    }

    // 7. Baseline bar: Protocol identity removed, Signature & Explore Story anchor present
    await expect(page.getByText('SYS // TEMPORAL EVIDENCE PROTOCOL')).toHaveCount(0);
    await expect(page.getByText('Clarity, even as facts change.')).toBeVisible();
    const exploreStory = page.getByRole('link', { name: /explore story/i });
    await expect(exploreStory).toBeVisible();
    await expect(exploreStory).toHaveAttribute('href', '#product');

    // 8. Verify Instrument Serif font, smaller size, stretched tracking, and faded creme color (#A8A09B)
    const computed = await h1.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        fontFamily: style.fontFamily,
        color: style.color,
        fontSize: parseFloat(style.fontSize),
        letterSpacing: style.letterSpacing,
        transform: style.transform,
      };
    });
    expect(computed.fontFamily.toLowerCase()).toContain('instrument serif');
    // Faded color #A8A09B is rgb(168, 160, 155)
    expect(computed.color).toBe('rgb(168, 160, 155)');
    // Smaller font size (sub-36px, e.g. ~32px on 1440px desktop)
    expect(computed.fontSize).toBeLessThanOrEqual(36);
    expect(computed.fontSize).toBeGreaterThanOrEqual(18);
    // Stretched horizontally
    expect(computed.transform).not.toBe('none');

    // 9. Verify AFTERFACT wordmark fade remains constant at 0.46 upon scratching
    const postScratchWordmarkOpacity = await page.evaluate(() => {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-wordmark-opacity').trim());
    });
    expect(postScratchWordmarkOpacity).toBeCloseTo(0.46, 2);
  });
});
