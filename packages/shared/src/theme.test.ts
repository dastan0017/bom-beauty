import { describe, expect, it } from 'vitest';
import { appearanceWarnings, buildThemeVars, DEFAULT_APPEARANCE, relativeLuminance, THEMES } from './theme';

describe('buildThemeVars', () => {
  it('default: rose theme with the sky-blue header and footer from the design', () => {
    const v = buildThemeVars(DEFAULT_APPEARANCE);
    expect(v['--ac']).toBe('#D12F63');
    expect(v['--bg']).toBe('#FEF6F8');
    // The glow fades into the page background, so no edge shows under the hero.
    expect(v['--hbg']).toContain('rgba(254,246,248,0)');
    expect(v['--hdr']).toBe('#aacdeb');
    expect(v['--ft']).toBe('#aacdeb');
    expect(v['--tt']).toBe('rgba(255,255,255,.42)');
    expect(v['--ftw']).toBe('none');
    expect(v['--ftc']).toBe('block');
    expect(v['--fhi']).toBe('italic');
  });

  it('white header keeps the theme footer and tabs', () => {
    const v = buildThemeVars({ theme: 'rose', headerColor: '#ffffff', accentColor: '#d12f63' });
    expect(v['--hdr']).toBe('#FFFFFF');
    expect(v['--ft']).toBe('#0E0E2C');
    expect(v['--tt']).toBe('#F4F1F3');
    expect(v['--ftw']).toBeUndefined();
  });

  it('custom accent derives soft and ink shades with color-mix', () => {
    const v = buildThemeVars({ theme: 'sky', headerColor: '#aacdeb', accentColor: '#1f7a5a' });
    expect(v['--ac']).toBe('#1f7a5a');
    expect(v['--acs']).toBe('color-mix(in srgb, #1f7a5a 13%, #FFFFFF)');
    expect(v['--hl2']).toBe('#1f7a5a');
  });

  it('accent equal to the theme accent keeps the hand-tuned theme shades', () => {
    const v = buildThemeVars({ theme: 'indigo', headerColor: '#ffffff', accentColor: '#4052d6' });
    expect(v['--acs']).toBe(THEMES.indigo.vars['--acs']);
  });
});

describe('appearanceWarnings', () => {
  it('flags dark headers and low-contrast accents like the admin design', () => {
    expect(appearanceWarnings({ headerColor: '#aacdeb', accentColor: '#d12f63' })).toEqual({
      headerTooDark: false,
      accentLowContrast: false,
    });
    expect(appearanceWarnings({ headerColor: '#13233f', accentColor: '#aacdeb' })).toEqual({
      headerTooDark: true,
      accentLowContrast: true,
    });
  });

  it('computes WCAG luminance', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
    expect(relativeLuminance('#000000')).toBeCloseTo(0);
  });
});
