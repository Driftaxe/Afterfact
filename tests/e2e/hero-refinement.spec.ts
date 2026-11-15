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

    // 4. Verify Temporal Verification Strip is below the initial 100vh viewport fold
    // Verify Demo: and mode switcher buttons are removed
    await expect(page.getByText(/^DEMO:/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /TEMPORAL CHANGE/i })).toHaveCount(0);

    const track = page.locator('.group\\/track');
    // Verify it is positioned below the initial viewport fold (>= 900px on 900px viewport)
    const initialTrackBox = await track.boundingBox();
    expect(initialTrackBox).not.toBeNull();
    if (initialTrackBox) {
      expect(initialTrackBox.y).toBeGreaterThanOrEqual(850);
    }

    // Scroll into view to interact with it
    await track.scrollIntoViewIfNeeded();

    // Initial randomly selected pair (Pluto or UK) assertion is visible
    const isPluto = await page.getByText('the ninth planet in our solar system.').count() > 0;
    const initialWrongPart = isPluto
      ? 'the ninth planet in our solar system.'
      : 'is a member of the European Union.';
    await expect(page.getByText(initialWrongPart)).toBeVisible();

    // Verification lens exists with enlarged triangular logo
    const lens = page.locator('.group\\/lens');
    await expect(lens).toBeVisible();
    const lensSvg = lens.locator('svg[viewBox="0 0 60 64"]');
    await expect(lensSvg).toBeVisible();
    expect(await lensSvg.getAttribute('width')).toBe('24');

    // 5. Drag the lens across the sentence to undercut the claim and reveal the corrected assertion after it
    const trackBox = await track.boundingBox();
    expect(trackBox).not.toBeNull();

    if (trackBox) {
      await page.mouse.move(trackBox.x + 5, trackBox.y + trackBox.height / 2);
      await page.mouse.down();
      for (let offset = 20; offset <= trackBox.width + 20; offset += 30) {
        await page.mouse.move(trackBox.x + offset, trackBox.y + trackBox.height / 2);
      }
      await page.mouse.up();

      // Upon completion: Corrected text appears AFTER undercut, CORRECTED badge & effective date appear
      const expectedCorrected = isPluto
        ? 'classified as a dwarf planet.'
        : 'left the European Union on 31 January 2020.';
      const expectedDate = isPluto ? 'August 2006' : '31 January 2020';

      await expect(page.getByText(expectedCorrected)).toBeVisible();
      await expect(page.getByText('CORRECTED')).toBeVisible();
      await expect(page.getByText(expectedDate, { exact: true })).toBeVisible();
    }

    // 6. Test Navbar Navigation from /app back to Landing Sections (Verifying bug fix)
    // Scroll back to top so navbar headroom reveals the header
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);

    const getStartedLink = page.getByRole('link', { name: /get started/i }).first();
    await getStartedLink.click();
    await expect(page).toHaveURL(/\/app/);

    // On /app, click PRODUCT navbar link and verify it navigates back to landing page section
    const productLink = page.getByRole('link', { name: 'PRODUCT' }).first();
    await expect(productLink).toBeVisible();
    await productLink.click();
    await expect(page).toHaveURL(/\/#product/);
    await expect(page.locator('#product')).toBeVisible();

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
