import type { ThemeKey } from './enums';

/**
 * Theme engine for the client site. Port of TH, BLUEHDR, hdrOnly and siteVars in
 * design/Bom Beauty Prototype.dc.html and of PRESETS / swatches / warnings in design/BomAdmin.dc.html.
 * The output is a map of CSS custom properties rendered on <html>.
 */

export type CssVars = Record<`--${string}`, string>;

export interface Appearance {
  theme: ThemeKey;
  headerColor: string;
  accentColor: string;
}

const vars = (values: Record<string, string>): CssVars => {
  const out: CssVars = {};
  for (const [key, value] of Object.entries(values)) out[`--${key}`] = value;
  return out;
};

// prettier-ignore
const ROSE = vars({
  bg: '#FEF6F8', sf: '#FFFFFF', sf2: '#F2F3F8', ln: '#E6E8F0', ln2: '#EEF0F5', lnh: '#CDD1E2',
  ink: '#14142B', mu: '#5B5F7A', ac: '#D12F63', ac2: '#E8603C', aci: '#B3264F', acs: '#FBE0EA',
  halo: 'rgba(209,47,99,.09)', acsh: 'rgba(209,47,99,.5)', pk: '#D12F63', hl: '#D12F63', hl2: '#D12F63',
  hbg: 'radial-gradient(120% 340px at 50% 0%, #FCEEF3 0%, rgba(254,246,248,0) 100%)',
  hink: '#14142B', hmu: '#5B5F7A', hhalo: 'rgba(209,47,99,.09)', hrad: '0px', hal: 'center', hta: 'center',
  h1s: '37px', glow: '#FCEEF3', hdr: '#FFFFFF', hdrl: '#E9EBF2', wab: '#E6E8F0', rw: '12px', tt: '#F4F1F3',
  ti: '#5B5F7A', toi: '#14142B', rt: '13px', rti: '10px', tth: 'rgba(20,20,43,.04)', ft: '#0E0E2C',
  fti: '#E7E8F3', ftm: '#8D90AB', ftl: 'rgba(255,255,255,.1)', chip: '#14142B', rc: '20px', rb: '14px',
  poster: '#F8E3EA', cbg: '#FFFFFF',
  cbgi: 'radial-gradient(120% 240px at 50% 0%, #FCEEF3 0%, rgba(255,255,255,0) 100%)',
});

// prettier-ignore
const SKY = vars({
  bg: '#F5F8FB', sf: '#FFFFFF', sf2: '#EEF2F7', ln: '#E3E8EF', ln2: '#EDF1F6', lnh: '#C9D3E0',
  ink: '#13233F', mu: '#59647A', ac: '#2F6BB0', ac2: '#7B5CC8', aci: '#255A99', acs: '#E3EEF9',
  halo: 'rgba(47,107,176,.1)', acsh: 'rgba(47,107,176,.45)', pk: '#DE366B', hl: '#2F6BB0', hl2: '#2F6BB0',
  hbg: 'radial-gradient(120% 360px at 50% 0%, #D8E8F6 0%, rgba(245,248,251,0) 100%)',
  hink: '#13233F', hmu: '#59647A', hhalo: 'rgba(47,107,176,.1)', hrad: '0px', hal: 'center', hta: 'center',
  h1s: '37px', glow: '#E8F1FA', hdr: '#FFFFFF', hdrl: '#E6EBF2', wab: '#E3E8EF', rw: '12px', tt: '#EEF2F7',
  ti: '#59647A', toi: '#13233F', rt: '13px', rti: '10px', tth: 'rgba(19,35,63,.04)', ft: '#13233F',
  fti: '#E8EDF5', ftm: '#9AA6BB', ftl: 'rgba(255,255,255,.1)', chip: '#13233F', rc: '20px', rb: '14px',
  poster: '#DCE9F6', cbg: '#FFFFFF',
  cbgi: 'radial-gradient(120% 240px at 50% 0%, #E3EEF9 0%, rgba(255,255,255,0) 100%)',
});

// prettier-ignore
const INDIGO = vars({
  bg: '#F6F7FB', sf: '#FFFFFF', sf2: '#F0F1F7', ln: '#E6E8F0', ln2: '#EEF0F5', lnh: '#CDD1E2',
  ink: '#14142B', mu: '#5B5F7A', ac: '#4052D6', ac2: '#9B4FD0', aci: '#3445C8', acs: '#E2E6FB',
  halo: 'rgba(64,82,214,.1)', acsh: 'rgba(64,82,214,.5)', pk: '#4052D6', hl: '#4052D6', hl2: '#4052D6',
  hbg: 'radial-gradient(120% 360px at 50% 0%, #E3E7FB 0%, rgba(246,247,251,0) 100%)',
  hink: '#14142B', hmu: '#5B5F7A', hhalo: 'rgba(64,82,214,.1)', hrad: '0px', hal: 'center', hta: 'center',
  h1s: '37px', glow: '#ECEEFC', hdr: '#FFFFFF', hdrl: '#E9EBF2', wab: '#E6E8F0', rw: '12px', tt: '#F0F1F7',
  ti: '#5B5F7A', toi: '#14142B', rt: '13px', rti: '10px', tth: 'rgba(20,20,43,.04)', ft: '#0E0E2C',
  fti: '#E7E8F3', ftm: '#8D90AB', ftl: 'rgba(255,255,255,.1)', chip: '#14142B', rc: '20px', rb: '14px',
  poster: '#E4E8FB', cbg: '#FFFFFF',
  cbgi: 'radial-gradient(120% 240px at 50% 0%, #E6E9FB 0%, rgba(255,255,255,0) 100%)',
});

export interface ThemePreset {
  label: string;
  note: string;
  headerColor: string;
  accentColor: string;
  /** Page background, used for the admin preview. */
  bg: string;
  vars: CssVars;
}

export const THEMES: Record<ThemeKey, ThemePreset> = {
  rose: {
    label: 'Розовая',
    note: 'голубая шапка · выбор Нурайым',
    headerColor: '#aacdeb',
    accentColor: '#d12f63',
    bg: '#FEF6F8',
    vars: ROSE,
  },
  sky: {
    label: 'Небесно-голубая',
    note: 'голубая шапка и кнопки',
    headerColor: '#aacdeb',
    accentColor: '#2f6bb0',
    bg: '#F5F8FB',
    vars: SKY,
  },
  indigo: {
    label: 'Индиго',
    note: 'белая шапка, синие кнопки',
    headerColor: '#ffffff',
    accentColor: '#4052d6',
    bg: '#F6F7FB',
    vars: INDIGO,
  },
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'rose',
  headerColor: '#aacdeb',
  accentColor: '#d12f63',
};

export const HEADER_SWATCHES = ['#aacdeb', '#ffffff', '#f8dce6', '#dde3fb', '#d7eee5', '#f3e7d3'] as const;
export const ACCENT_SWATCHES = ['#2f6bb0', '#1f5596', '#d12f63', '#4052d6', '#1f7a5a', '#13233f'] as const;

/** Header colours imply a matching footer and translucent tabs (design: BLUEHDR). */
// prettier-ignore
const COLOURED_HEADER = vars({
  hdrl: 'rgba(19,35,63,0)', wab: 'rgba(19,35,63,0)', tt: 'rgba(255,255,255,.42)', ti: '#1C3150',
  toi: '#13233F', tth: 'rgba(255,255,255,.35)', fti: '#13233F', ftm: '#2A3F5F', ftl: 'rgba(19,35,63,.14)',
  ftw: 'none', ftc: 'block',
});

/** Cormorant Garamond headings with the italic accent word (design: HFONT). */
const HEADING_FONT = vars({
  fh: "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif",
  fhw: '600',
  fhls: '-0.005em',
  fhk: '1.16',
  fhi: 'italic',
});

const mix = (colour: string, percent: number, other: string): string =>
  `color-mix(in srgb, ${colour} ${percent}%, ${other})`;

const isWhite = (colour: string): boolean => /^#?(fff|ffffff)$/i.test(colour);

function headerVars(base: CssVars, header: string): CssVars {
  if (isWhite(header)) return vars({ hdr: '#FFFFFF' });
  return {
    ...COLOURED_HEADER,
    ...vars({
      hdr: header,
      ft: header,
      whb: 'radial-gradient(120% 300px at 50% 0%, var(--glow,#FCEEF3) 0%, rgba(255,255,255,0) 100%)',
      whi: base['--ti'] ?? '#5B5F7A',
      wht: base['--tt'] ?? '#F4F1F3',
    }),
  };
}

function accentVars(base: CssVars, accent: string): CssVars {
  if (accent.toLowerCase() === (base['--ac'] ?? '').toLowerCase()) return {};
  return vars({
    ac: accent,
    ac2: `color-mix(in oklch, ${accent} 60%, #E8603C)`,
    aci: mix(accent, 82, '#000000'),
    acs: mix(accent, 13, '#FFFFFF'),
    halo: mix(accent, 12, 'transparent'),
    acsh: mix(accent, 45, 'transparent'),
    hl: mix(accent, 85, '#000000'),
    hl2: accent,
    hbg: `radial-gradient(120% 360px at 50% 0%, ${mix(accent, 14, '#FFFFFF')} 0%, rgba(255,255,255,0) 100%)`,
    glow: mix(accent, 9, '#FFFFFF'),
    poster: mix(accent, 16, '#FFFFFF'),
  });
}

/** Full set of CSS custom properties for the site, given the owner's appearance settings. */
export function buildThemeVars(appearance: Appearance = DEFAULT_APPEARANCE): CssVars {
  const base = THEMES[appearance.theme].vars;
  return {
    ...base,
    ...accentVars(base, appearance.accentColor),
    ...headerVars(base, appearance.headerColor),
    ...HEADING_FONT,
  };
}

/** WCAG relative luminance of a #rrggbb colour; non-hex input counts as white. */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return 1;
  const channel = (offset: number): number => {
    const value = parseInt(clean.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Warnings shown in "Оформление" (design: hdrWarn, accWarn). */
export function appearanceWarnings(appearance: Pick<Appearance, 'headerColor' | 'accentColor'>): {
  headerTooDark: boolean;
  accentLowContrast: boolean;
} {
  return {
    headerTooDark: relativeLuminance(appearance.headerColor) < 0.3,
    accentLowContrast: 1.05 / (relativeLuminance(appearance.accentColor) + 0.05) < 4.5,
  };
}
