import { describe, it, expect } from 'vitest';
import { resolveValidTheme } from '@/components/theme/ThemeProvider';

function luminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g)!.map((x) => {
    const v = parseInt(x, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Number(ratio.toFixed(2));
}

describe('Theme Resolution Contract (C01-02, C01-05)', () => {
  it('defaults to dark when input is null, undefined, or empty', () => {
    expect(resolveValidTheme(null)).toBe('dark');
    expect(resolveValidTheme(undefined)).toBe('dark');
    expect(resolveValidTheme('')).toBe('dark');
  });

  it('preserves valid theme inputs', () => {
    expect(resolveValidTheme('dark')).toBe('dark');
    expect(resolveValidTheme('light')).toBe('light');
  });

  it('falls back to dark on arbitrary invalid or corrupted stored values', () => {
    expect(resolveValidTheme('blue')).toBe('dark');
    expect(resolveValidTheme('system')).toBe('dark');
    expect(resolveValidTheme('auto')).toBe('dark');
    expect(resolveValidTheme('{"theme":"light"}')).toBe('dark');
    expect(resolveValidTheme('NaN')).toBe('dark');
  });
});

describe('Design Token WCAG AA Contrast Verification (C01-09)', () => {
  describe('Dark Mode Palette', () => {
    const darkBg = '#111214';
    const darkSurface = '#18191C';
    const darkRaised = '#202125';
    const darkPrimaryText = '#E7E5E2';
    const darkSecondaryText = '#AAA8A5';
    const darkMutedText = '#85858D';
    const darkAccent = '#B5AEBD';
    const darkBtnPrimaryBg = '#DEDBD6';
    const darkBtnPrimaryText = '#191A1D';

    it('satisfies WCAG AA contrast for text (> 4.5:1)', () => {
      expect(contrastRatio(darkBg, darkPrimaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkBg, darkSecondaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkBg, darkMutedText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkSurface, darkPrimaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkSurface, darkSecondaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkSurface, darkMutedText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkRaised, darkPrimaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkRaised, darkSecondaryText)).toBeGreaterThanOrEqual(4.5);
    });

    it('satisfies WCAG AA contrast for primary CTA button (> 4.5:1)', () => {
      expect(contrastRatio(darkBtnPrimaryBg, darkBtnPrimaryText)).toBeGreaterThanOrEqual(4.5);
    });

    it('satisfies WCAG AA contrast for accent on dark surfaces (> 4.5:1)', () => {
      expect(contrastRatio(darkBg, darkAccent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkSurface, darkAccent)).toBeGreaterThanOrEqual(4.5);
    });

    it('satisfies WCAG AA contrast for dark status badge pairs (> 4.5:1)', () => {
      const darkBadges = [
        { name: 'Supported', bg: '#192720', text: '#9CD7B4' },
        { name: 'Outdated', bg: '#282115', text: '#E8C07A' },
        { name: 'Contradicted', bg: '#28181B', text: '#E69AA4' },
        { name: 'Unresolved', bg: '#202125', text: '#C2C0BD' },
        { name: 'Checking', bg: '#1F2128', text: '#B5AEBD' },
      ];

      for (const badge of darkBadges) {
        const ratio = contrastRatio(badge.bg, badge.text);
        expect(ratio, `${badge.name} contrast ratio ${ratio} must be >= 4.5`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe('Light Mode Palette', () => {
    const lightBg = '#F7F5F0';
    const lightSurface = '#FFFFFF';
    const lightPrimaryText = '#1A1B1E';
    const lightSecondaryText = '#5A5854';
    const lightAccent = '#5C4E68';

    it('satisfies WCAG AA contrast for text (> 4.5:1)', () => {
      expect(contrastRatio(lightBg, lightPrimaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightBg, lightSecondaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightSurface, lightPrimaryText)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightSurface, lightSecondaryText)).toBeGreaterThanOrEqual(4.5);
    });

    it('satisfies WCAG AA contrast for accent on light surfaces (> 4.5:1)', () => {
      expect(contrastRatio(lightBg, lightAccent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightSurface, lightAccent)).toBeGreaterThanOrEqual(4.5);
    });

    it('satisfies WCAG AA contrast for light status badge pairs (> 4.5:1)', () => {
      const lightBadges = [
        { name: 'Supported', bg: '#EDF5F0', text: '#22583B' },
        { name: 'Outdated', bg: '#FBF5EA', text: '#764F0E' },
        { name: 'Contradicted', bg: '#FAF0F1', text: '#832C37' },
        { name: 'Unresolved', bg: '#F2F0EC', text: '#4A4844' },
        { name: 'Checking', bg: '#F3F0F6', text: '#544660' },
      ];

      for (const badge of lightBadges) {
        const ratio = contrastRatio(badge.bg, badge.text);
        expect(ratio, `${badge.name} contrast ratio ${ratio} must be >= 4.5`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});
