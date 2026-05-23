// ============================================
// GRUPO POPPER - Design Tokens (Premium private bank)
// ============================================
// Sistema de design tokens centralizado. Toda decisión visual nace acá.
// Filosofía: elegancia restringida, jerarquía clara, animaciones suizas.
// ============================================

export const colors = {
  // Paleta principal - oro acuñado de Grupo Popper
  gold: '#bfa363',
  goldLight: '#d4b978',
  goldDeep: '#9d8649',
  goldPale: '#e8d9b3',

  // Carbón - los grises oscuros base
  carbon: '#0a0e14',
  carbonLight: '#0f1929',
  carbonDeep: '#06090f',
  carbonRich: '#13192a',

  // Crema - para acentos cálidos
  cream: '#f5f1e8',
  creamMuted: '#e8e0cf',

  // Texto - jerarquía precisa
  text: {
    primary: 'rgba(255, 255, 255, 0.95)',
    secondary: 'rgba(255, 255, 255, 0.65)',
    tertiary: 'rgba(255, 255, 255, 0.40)',
    quaternary: 'rgba(255, 255, 255, 0.22)',
    whisper: 'rgba(255, 255, 255, 0.10)',
  },

  // Bordes - hairlines casi imperceptibles
  border: {
    whisper: 'rgba(255, 255, 255, 0.04)',
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    gold: 'rgba(191, 163, 99, 0.18)',
    goldStrong: 'rgba(191, 163, 99, 0.35)',
  },

  // Estados - paleta restringida y suave
  success: {
    base: '#7fc99f',
    bg: 'rgba(127, 201, 159, 0.08)',
    border: 'rgba(127, 201, 159, 0.20)',
  },
  danger: {
    base: '#e89089',
    bg: 'rgba(232, 144, 137, 0.08)',
    border: 'rgba(232, 144, 137, 0.22)',
  },
  warning: {
    base: '#e0b76c',
    bg: 'rgba(224, 183, 108, 0.08)',
    border: 'rgba(224, 183, 108, 0.22)',
  },

  // Gradientes premium
  gradient: {
    gold: 'linear-gradient(135deg, #bfa363 0%, #d4b978 50%, #bfa363 100%)',
    goldVertical: 'linear-gradient(180deg, #d4b978 0%, #bfa363 100%)',
    radialBackground: 'radial-gradient(ellipse at 50% 0%, #0f1b2e 0%, #080e1a 70%)',
    cardElevated: 'linear-gradient(180deg, rgba(15,25,42,0.95) 0%, rgba(10,16,28,0.98) 100%)',
    goldGlow: 'radial-gradient(ellipse, rgba(191,163,99,0.12), transparent 70%)',
    creamSheen: 'linear-gradient(180deg, rgba(245,241,232,0.04) 0%, transparent 100%)',
  },
};

// ============================================
// Typography - jerarquía premium
// ============================================
export const fonts = {
  serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
};

export const typography = {
  // Display - momentos heroicos
  display: {
    fontFamily: fonts.serif,
    fontSize: 'clamp(36px, 6vw, 56px)',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.08,
  },
  // Title - encabezados de pantalla
  title: {
    fontFamily: fonts.serif,
    fontSize: '32px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: 1.15,
  },
  // Heading - secciones
  heading: {
    fontFamily: fonts.serif,
    fontSize: '22px',
    fontWeight: 600,
    letterSpacing: '-0.005em',
    lineHeight: 1.25,
  },
  // Subheading - subsecciones
  subheading: {
    fontFamily: fonts.sans,
    fontSize: '15px',
    fontWeight: 500,
    letterSpacing: '0.005em',
    lineHeight: 1.45,
  },
  // Body
  body: {
    fontFamily: fonts.sans,
    fontSize: '14px',
    fontWeight: 400,
    letterSpacing: '0.005em',
    lineHeight: 1.55,
  },
  // Small
  small: {
    fontFamily: fonts.sans,
    fontSize: '12px',
    fontWeight: 400,
    letterSpacing: '0.01em',
    lineHeight: 1.5,
  },
  // Eyebrow - micro labels uppercase
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.22em',
    textTransform: 'uppercase' as const,
    lineHeight: 1,
  },
  // Numeric - cifras con tabular nums
  numeric: {
    fontFamily: fonts.sans,
    fontVariantNumeric: 'tabular-nums' as const,
    fontFeatureSettings: '"tnum" 1, "ss01" 1',
  },
  // Display numeric - cifras grandes serif
  numericDisplay: {
    fontFamily: fonts.serif,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
    fontFeatureSettings: '"tnum" 1, "lnum" 1',
    letterSpacing: '-0.02em',
  },
};

// ============================================
// Spacing - escala basada en 4px
// ============================================
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '96px',
};

// ============================================
// Border radius
// ============================================
export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '24px',
  full: '9999px',
};

// ============================================
// Shadows - con toque cálido (no negro puro)
// ============================================
export const shadows = {
  whisper: '0 1px 2px rgba(0, 0, 0, 0.04)',
  subtle: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  card: '0 8px 28px rgba(8, 14, 26, 0.35), 0 2px 6px rgba(0, 0, 0, 0.15)',
  elevated: '0 20px 60px rgba(8, 14, 26, 0.5), 0 4px 12px rgba(0, 0, 0, 0.2)',
  goldGlow: '0 0 40px rgba(191, 163, 99, 0.12), 0 0 80px rgba(191, 163, 99, 0.06)',
  goldGlowIntense: '0 0 60px rgba(191, 163, 99, 0.22), 0 8px 32px rgba(191, 163, 99, 0.18)',
  innerGold: 'inset 0 1px 0 rgba(212, 185, 120, 0.12)',
};

// ============================================
// Animation - timing y easing de banco suizo
// ============================================
export const ease = {
  // Curvas premium - lentas, naturales, "swiss precision"
  swift: 'cubic-bezier(0.32, 0.72, 0, 1)',       // entrada rápida y elegante
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',        // transición universal
  swiss: 'cubic-bezier(0.65, 0, 0.35, 1)',       // refinada
  luxury: 'cubic-bezier(0.16, 1, 0.3, 1)',       // muy lenta, premium
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',   // bounce suave
};

export const duration = {
  instant: '120ms',
  fast: '200ms',
  base: '320ms',
  slow: '500ms',
  slower: '800ms',
  cinematic: '1200ms',
  premium: '1600ms',
};

// ============================================
// Z-index scale
// ============================================
export const z = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 800,
  modal: 1000,
  toast: 1100,
  tooltip: 1200,
};

// ============================================
// Atajos compuestos para usar directo
// ============================================
export const t = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  tertiary: colors.text.tertiary,
  quaternary: colors.text.quaternary,
};

export const c = colors;
