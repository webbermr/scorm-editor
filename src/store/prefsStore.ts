// User preferences (the prototype's "Tweaks" → real, persisted settings).
// Drives the CSS-variable theming layer: accent, dark mode, font pairing, density.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AccentName = 'Violet' | 'Teal' | 'Coral' | 'Indigo';
export type FontName = 'Bricolage + Hanken' | 'Hanken' | 'Fraunces + Hanken' | 'Space Grotesk';
export type Density = 'compact' | 'regular' | 'comfy';

export const ACCENTS: Record<AccentName, { accent: string; press: string; soft: string; ink: string }> = {
  Violet: { accent: '#6d4ee0', press: '#5a3dc8', soft: '#efe9ff', ink: '#4a2fb0' },
  Teal: { accent: '#0d9488', press: '#0b7d73', soft: '#d9f3f0', ink: '#0a6b62' },
  Coral: { accent: '#e2563c', press: '#c9462e', soft: '#fce4dd', ink: '#b23a25' },
  Indigo: { accent: '#3f5bd9', press: '#3349bd', soft: '#e4e8fc', ink: '#2a3aa0' },
};

// In dark mode the accent-soft tokens differ per accent (darkened). Light values come from ACCENTS.
const DARK_ACCENT_SOFT: Record<AccentName, string> = {
  Violet: '#2e2552',
  Teal: '#0c2f2c',
  Coral: '#3a201c',
  Indigo: '#1e2450',
};

export const FONTS: Record<FontName, { display: string; ui: string }> = {
  'Bricolage + Hanken': { display: "'Bricolage Grotesque'", ui: "'Hanken Grotesk'" },
  Hanken: { display: "'Hanken Grotesk'", ui: "'Hanken Grotesk'" },
  'Fraunces + Hanken': { display: "'Fraunces'", ui: "'Hanken Grotesk'" },
  'Space Grotesk': { display: "'Space Grotesk'", ui: "'Space Grotesk'" },
};

export const DENSITY: Record<Density, { rail: number; insp: number }> = {
  compact: { rail: 256, insp: 290 },
  regular: { rail: 296, insp: 324 },
  comfy: { rail: 336, insp: 360 },
};

export interface Prefs {
  accent: AccentName;
  font: FontName;
  density: Density;
  dark: boolean;
  setAccent: (a: AccentName) => void;
  setFont: (f: FontName) => void;
  setDensity: (d: Density) => void;
  setDark: (v: boolean) => void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      accent: 'Violet',
      font: 'Bricolage + Hanken',
      density: 'regular',
      dark: false,
      setAccent: (accent) => set({ accent }),
      setFont: (font) => set({ font }),
      setDensity: (density) => set({ density }),
      setDark: (dark) => set({ dark }),
    }),
    { name: 'scorm-editor.prefs' },
  ),
);

/** Build the inline CSS-variable style object applied to the app root. */
export function rootThemeVars(p: Pick<Prefs, 'accent' | 'font' | 'density' | 'dark'>): Record<string, string> {
  const ac = ACCENTS[p.accent];
  const fo = FONTS[p.font];
  const dens = DENSITY[p.density];
  const vars: Record<string, string> = {
    '--accent': ac.accent,
    '--accent-press': ac.press,
    '--accent-soft': p.dark ? DARK_ACCENT_SOFT[p.accent] : ac.soft,
    '--accent-ink': ac.ink,
    '--font-display': `${fo.display}, sans-serif`,
    '--font-ui': `${fo.ui}, sans-serif`,
    '--rail-w': dens.rail + 'px',
    '--inspector-w': dens.insp + 'px',
  };
  return vars;
}
