import { test, expect } from '@playwright/test';

test.describe('Hero Refinements Verification', () => {
  test('verifies more faded larger AFTERFACT title, claim headline moved to bottom strip with horizontal compression, removal of clarity and explore story, and constant fade', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 0. Verify AFTERFACT wordmark opacity is more faded (0.24) and remains constant
    const initialWordmarkOpacity = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--hero-wordmark-opacity').trim();
    });
    expect(parseFloat(initialWordmarkOpacity)).toBeCloseTo(0.24, 2);

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

    // 4. Verify AFTERFACT TITLE is visible, slightly larger (> 1200px on 1440px viewport)
    const wordmark = page.locator('img.hero-wordmark');
    await expect(wordmark).toBeVisible();
    const wordmarkBox = await wordmark.boundingBox();
    const headlineBox = await h1.boundingBox();
    expect(wordmarkBox).not.toBeNull();
    expect(headlineBox).not.toBeNull();

    if (wordmarkBox) {
      expect(wordmarkBox.width).toBeGreaterThan(1200);
    }

    // 5. Verify Buttons are positioned in central hero below the title
    const verifyBtn = page.getByRole('link', { name: /verify an answer/i }).first();
    const sampleBtn = page.getByRole('link', { name: /view sample report/i }).first();
    await expect(verifyBtn).toBeVisible();
    await expect(sampleBtn).toBeVisible();

    const verifyBox = await verifyBtn.boundingBox();
    expect(verifyBox).not.toBeNull();
    if (verifyBox && wordmarkBox) {
      expect(verifyBox.y).toBeGreaterThan(wordmarkBox.y);
      expect(verifyBox.height).toBeLessThan(40);
    }

    // 6. Verify "Every claim has a story." is moved to the bottom strip (below the buttons)
    if (headlineBox && verifyBox) {
      expect(headlineBox.y).toBeGreaterThan(verifyBox.y);
    }

    // 7. Verify "Clarity, even as facts change." and "EXPLORE STORY" are removed from strip
    await expect(page.getByText('Clarity, even as facts change.')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /explore story/i })).toHaveCount(0);

    // 8. Move mouse over headline in the strip and verify no stray circle cursor at top
    if (headlineBox) {
      await page.mouse.move(headlineBox.x + 30, headlineBox.y + 10);
      await page.mouse.move(headlineBox.x + 100, headlineBox.y + 10);

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

    // 9. Verify Instrument Serif font, compressed size, scaleX(0.94), and color
    const computed = await h1.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        fontFamily: style.fontFamily,
        color: style.color,
        fontSize: parseFloat(style.fontSize),
        transform: style.transform,
      };
    });
    expect(computed.fontFamily.toLowerCase()).toContain('instrument serif');
    expect(computed.color).toBe('rgb(168, 160, 155)');
    expect(computed.fontSize).toBeLessThanOrEqual(20);
    expect(computed.fontSize).toBeGreaterThanOrEqual(13);
    expect(computed.transform).not.toBe('none');

    // 10. Verify AFTERFACT wordmark fade remains constant at 0.24 upon scratching
    const postScratchWordmarkOpacity = await page.evaluate(() => {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-wordmark-opacity').trim());
    });
    expect(postScratchWordmarkOpacity).toBeCloseTo(0.24, 2);
  });
});
