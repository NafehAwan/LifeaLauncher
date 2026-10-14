import type { Config } from 'tailwindcss';

const v = (n: string) => `var(--${n})`;
/** Token colour that still supports Tailwind opacity modifiers (bg-accent/20) via color-mix. */
const c = (n: string) => `color-mix(in srgb, var(--${n}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg0: c('bg-0'), bg1: c('bg-1'), bg2: c('bg-2'), bg3: c('bg-3'), bg4: c('bg-4'),
        line: { DEFAULT: c('line'), strong: c('line-strong') },
        t1: c('text-1'), t2: c('text-2'), t3: c('text-3'),
        accent: { DEFAULT: c('accent'), hi: c('accent-hi'), lo: c('accent-lo'), glow: v('accent-glow'), soft: v('accent-soft') },
        ember: c('ember'), success: c('success'), warning: c('warning'), danger: c('danger'), info: c('info'),
      },
      borderRadius: { sm: v('r-sm'), md: v('r-md'), lg: v('r-lg'), xl: v('r-xl') },
      boxShadow: { 1: v('shadow-1'), 2: v('shadow-2'), glow: '0 0 0 6px var(--accent-glow)' },
      fontFamily: { ui: v('font-ui'), mono: v('font-mono'), pixel: v('font-pixel') },
      fontSize: { '2xs': ['11px', '14px'], xs: ['12px', '16px'], sm: ['13px', '18px'], base: ['14px', '20px'], md: ['16px', '22px'], lg: ['20px', '26px'], xl: ['28px', '34px'], '2xl': ['40px', '46px'] },
      transitionTimingFunction: { out: v('ease') },
      transitionDuration: { 1: '120ms', 2: '180ms', 3: '260ms' },
    },
  },
  plugins: [],
} satisfies Config;
