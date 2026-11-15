import { test, expect } from '@playwright/test';

test.describe('Hero Refinements Verification', () => {
  test('verifies faded oversized AFTERFACT title, interactive temporal verification strip with magnifying lens, Pluto/UK pairs, dragging reveal, and completion state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 0. Verify AFTERFACT wordmark opacity is at 0.24 and constant
    const initialWordmarkOpacity = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--hero-wordmark-opacity').trim();
    });
    expect(parseFloat(initialWordmarkOpacity)).toBeCloseTo(0.24, 2);

    // 1. Eyebrows and discarded demo sections removed
    await expect(page.getByText('TEMPORAL EVIDENCE INTELLIGENCE')).toHaveCount(0);
    await expect(page.getByText(/Verify AI-generated answers against current sources/i)).toHaveCount(0);
    await expect(page.getByText(/move to reveal/i)).toHaveCount(0);
    await expect(page.getByText('TRACE THE CLAIM')).toHaveCount(0);
    await expect(page.getByText('INSPECT THE EVIDENCE')).toHaveCount(0);
    await expect(page.getByText('TRACK WHAT CHANGES')).toHaveCount(0);

    // 2. Verify AFTERFACT TITLE is visible and oversized (> 1200px on 1440px viewport)
    const wordmark = page.locator('img.hero-wordmark');
    await expect(wordmark).toBeVisible();
    const wordmarkBox = await wordmark.boundingBox();
    expect(wordmarkBox).not.toBeNull();
    if (wordmarkBox) {
      expect(wordmarkBox.width).toBeGreaterThan(1200);
    }

    // 3. Verify Buttons are positioned in central hero below the title
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

    // 4. Verify Temporal Verification Strip in the bottom hero area
    // Initial Demonstration Pair 01: Pluto
    const plutoOriginal = page.getByText('Pluto is the ninth planet in our solar system.');
    await expect(plutoOriginal).toBeVisible();
    await expect(page.getByText('Before August 2006')).toBeVisible();

    // Verification lens exists
    const lens = page.locator('.group\\/lens');
    await expect(lens).toBeVisible();

    // 5. Drag the lens across the sentence to reveal the corrected assertion
    const track = page.locator('.group\\/track');
    const trackBox = await track.boundingBox();
    expect(trackBox).not.toBeNull();

    if (trackBox) {
      // Simulate precision drag from start to end of track
      await page.mouse.move(trackBox.x + 10, trackBox.y + trackBox.height / 2);
      await page.mouse.down();
      for (let offset = 20; offset <= trackBox.width; offset += 40) {
        await page.mouse.move(trackBox.x + offset, trackBox.y + trackBox.height / 2);
      }
      await page.mouse.up();

      // Upon completion: Corrected text becomes visible, CORRECTED badge & effective date appear
      const plutoCorrected = page.getByText('Pluto is classified as a dwarf planet.');
      await expect(plutoCorrected).toBeVisible();
      await expect(page.getByText('CORRECTED')).toBeVisible();
      await expect(page.getByText('August 2006')).toBeVisible();
    }

    // 6. Test Switching between Demonstration Pairs: Switch to 02 / TEMPORAL CHANGE (UK)
    const ukBtn = page.getByRole('button', { name: /TEMPORAL CHANGE/i });
    await expect(ukBtn).toBeVisible();
    await ukBtn.click();

    // Verify Pair 02 assertions
    const ukOriginal = page.getByText('The United Kingdom is a member of the European Union.');
    await expect(ukOriginal).toBeVisible();
    await expect(page.getByText('Before 31 January 2020')).toBeVisible();

    // Reveal UK assertion via keyboard interaction (accessible Space/Enter key)
    await page.keyboard.press('Enter');
    const ukCorrected = page.getByText('The United Kingdom left the European Union on 31 January 2020.');
    await expect(ukCorrected).toBeVisible();
    await expect(page.getByText('CORRECTED')).toBeVisible();
    await expect(page.getByText('31 January 2020', { exact: true })).toBeVisible();

    // 7. Verify removed elements stay removed
    await expect(page.getByText('Clarity, even as facts change.')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /explore story/i })).toHaveCount(0);

    // 8. Wordmark opacity remains steady at 0.24
    const postInspectionWordmarkOpacity = await page.evaluate(() => {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-wordmark-opacity').trim());
    });
    expect(postInspectionWordmarkOpacity).toBeCloseTo(0.24, 2);
  });
});
