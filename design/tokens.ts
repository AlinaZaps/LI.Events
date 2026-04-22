/**
 * Design tokens — mirror of design/tokens.css.
 * Use this for Tailwind config, chart colors, inline-style fallbacks.
 * CSS remains the source of truth at runtime (for theme switching via class).
 */

export const fontFamily = {
  display: "'Syne', ui-sans-serif, system-ui, sans-serif",
  body: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const fontSize = {
  '9': '9px',
  '10': '10px',
  '11': '11px',
  '12': '12px',
  '13': '13px',
  '14': '14px',
  '15': '15px',
  '16': '16px',
  '17': '17px',
  '20': '20px',
  '22': '22px',
  '26': '26px',
  '28': '28px',
} as const;

export const tracking = {
  tight: '0.05em',
  wide: '0.08em',
  wider: '0.1em',
} as const;

export const radius = {
  xs: '4px',
  sm: '6px',
  md: '7px',
  lg: '8px',
  xl: '12px',
  pill: '20px',
  round: '50%',
} as const;

export const space = {
  1: '4px',
  2: '6px',
  3: '8px',
  4: '10px',
  5: '12px',
  6: '14px',
  7: '16px',
  8: '18px',
  9: '20px',
  10: '24px',
  11: '28px',
} as const;

export const brand = {
  accent: '#5C67FF',
  pinkRaw: '#F7C2FF',
} as const;

type ThemeTokens = {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  accent: string;
  accentHover: string;
  accentDim: string;
  pink: string;
  pinkDim: string;
  green: string;
  greenDim: string;
  amber: string;
  amberDim: string;
  red: string;
  overlay: string;
  shadowCard: string;
  shadowCardHover: string;
  shadowPrimary: string;
  shadowPanel: string;
  shadowGlow: string;
  gradBrand: string;
  gradBar: string;
};

export const light: ThemeTokens = {
  bg: '#f5f4ff',
  surface: '#ffffff',
  surface2: '#f0efff',
  surface3: '#e8e7ff',
  border: 'rgba(92, 103, 255, 0.10)',
  borderStrong: 'rgba(92, 103, 255, 0.22)',
  text: '#16142e',
  muted: '#7b78a8',
  accent: '#5C67FF',
  accentHover: '#4450e8',
  accentDim: 'rgba(92, 103, 255, 0.08)',
  pink: '#d966f5',
  pinkDim: 'rgba(217, 102, 245, 0.08)',
  green: '#00a36e',
  greenDim: 'rgba(0, 163, 110, 0.08)',
  amber: '#c47f00',
  amberDim: 'rgba(196, 127, 0, 0.08)',
  red: '#d63b5a',
  overlay: 'rgba(22, 20, 46, 0.30)',
  shadowCard: '0 4px 20px rgba(92, 103, 255, 0.10)',
  shadowCardHover: '0 6px 24px rgba(92, 103, 255, 0.10)',
  shadowPrimary: '0 2px 12px rgba(92, 103, 255, 0.30)',
  shadowPanel: '-8px 0 32px rgba(92, 103, 255, 0.08)',
  shadowGlow: 'none',
  gradBrand: 'linear-gradient(135deg, #5C67FF, #F7C2FF)',
  gradBar: 'linear-gradient(90deg, #5C67FF, #d966f5)',
};

export const dark: ThemeTokens = {
  bg: '#0a0a12',
  surface: '#10101c',
  surface2: '#17172a',
  surface3: '#1e1e35',
  border: 'rgba(92, 103, 255, 0.12)',
  borderStrong: 'rgba(92, 103, 255, 0.25)',
  text: '#f4f0ff',
  muted: '#8880aa',
  accent: '#5C67FF',
  accentHover: '#8891ff',
  accentDim: 'rgba(92, 103, 255, 0.15)',
  pink: '#F7C2FF',
  pinkDim: 'rgba(247, 194, 255, 0.15)',
  green: '#6affcb',
  greenDim: 'rgba(106, 255, 203, 0.12)',
  amber: '#ffd97a',
  amberDim: 'rgba(255, 217, 122, 0.12)',
  red: '#ff8fa3',
  overlay: 'rgba(0, 0, 0, 0.60)',
  shadowCard: '0 6px 24px rgba(92, 103, 255, 0.10)',
  shadowCardHover: '0 6px 24px rgba(92, 103, 255, 0.20)',
  shadowPrimary: '0 0 18px rgba(92, 103, 255, 0.35)',
  shadowPanel: 'none',
  shadowGlow: '0 0 18px rgba(92, 103, 255, 0.25)',
  gradBrand: 'linear-gradient(135deg, #5C67FF, #F7C2FF)',
  gradBar: 'linear-gradient(90deg, #5C67FF, #F7C2FF)',
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;
