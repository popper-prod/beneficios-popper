// ============================================
// GRUPO POPPER — Design Tokens v2
// Filosofía: Linear + Vercel. Semántica clara, sin decoración.
// El acento (--brand) se usa con criterio, NO en todos lados.
// ============================================

export const colors = {
  // ===== Backgrounds (jerarquía de profundidad) =====
  bg: {
    canvas: '#080809',       // Fondo más profundo (body)
    surface: '#0e0e10',      // Paneles principales
    elevated: '#16161a',     // Cards elevados
    raised: '#1c1c22',       // Hover sobre elevated
    overlay: 'rgba(8, 8, 9, 0.7)', // Backdrop modales
  },

  // ===== Bordes (hairlines) =====
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',  // bordes default
    default: 'rgba(255, 255, 255, 0.10)', // bordes cards
    strong: 'rgba(255, 255, 255, 0.18)',  // bordes input focus
    brand: 'rgba(212, 160, 23, 0.30)',    // borde accent
  },

  // ===== Text (jerarquía) =====
  text: {
    primary: 'rgba(237, 237, 238, 1)',    // títulos, contenido principal
    secondary: 'rgba(237, 237, 238, 0.72)', // body, descripciones
    tertiary: 'rgba(237, 237, 238, 0.48)', // labels, metadata
    quaternary: 'rgba(237, 237, 238, 0.30)', // placeholders, deshabilitado
    quinary: 'rgba(237, 237, 238, 0.16)',  // hints muy sutiles
  },

  // ===== Acento brand (oro, pero CON CRITERIO) =====
  brand: {
    DEFAULT: '#d4a017',     // acento principal
    hover: '#e0ad22',       // hover
    muted: 'rgba(212, 160, 23, 0.12)', // bg sutil
    subtle: 'rgba(212, 160, 23, 0.08)',
    border: 'rgba(212, 160, 23, 0.25)',
    foreground: '#0a0a0a', // texto sobre botón brand
  },

  // ===== Semántica funcional =====
  success: {
    DEFAULT: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.10)',
    border: 'rgba(34, 197, 94, 0.25)',
    text: '#4ade80',
  },
  danger: {
    DEFAULT: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.25)',
    text: '#f87171',
  },
  warning: {
    DEFAULT: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.25)',
    text: '#fbbf24',
  },
  info: {
    DEFAULT: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.10)',
    border: 'rgba(59, 130, 246, 0.25)',
    text: '#60a5fa',
  },

  // ===== Niveles de colaborador (cada nivel tiene su color, NO todos dorados) =====
  tier: {
    bronce: { DEFAULT: '#b97842', bg: 'rgba(185, 120, 66, 0.12)', text: '#cd8d57' },
    plata: { DEFAULT: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', text: '#cbd5e1' },
    oro: { DEFAULT: '#d4a017', bg: 'rgba(212, 160, 23, 0.12)', text: '#e0ad22' },
    platinum: { DEFAULT: '#e4e4e7', bg: 'rgba(228, 228, 231, 0.08)', text: '#f4f4f5' },
  },
};

// ============================================
// Typography — Geist Variable (Vercel)
// Una sola familia, jerarquía con peso + tamaño
// ============================================
export const fonts = {
  sans: 'var(--font-geist), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'var(--font-geist-mono), "SF Mono", Menlo, Monaco, "Courier New", monospace',
};

// Type scale (rem para accesibilidad)
export const type = {
  // UI sizes (denso, eficiente)
  xs: '11px',     // micro labels, eyebrow
  sm: '12px',     // metadata, captions
  base: '13px',   // body UI, default
  md: '14px',     // body lectura
  lg: '15px',     // labels destacados
  xl: '18px',     // títulos sección
  '2xl': '22px',  // títulos página
  '3xl': '28px',  // hero numbers
  '4xl': '36px',  // display
  '5xl': '48px',  // hero display
};

export const weight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

// ============================================
// Spacing — escala 4px (Linear-style densa)
// ============================================
export const space = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
};

// ============================================
// Border radius
// ============================================
export const radius = {
  none: '0',
  xs: '3px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '20px',
  full: '9999px',
};

// ============================================
// Shadows — minimalistas (solo cuando importa)
// ============================================
export const shadow = {
  none: 'none',
  xs: '0 1px 2px rgba(0, 0, 0, 0.20)',
  sm: '0 2px 4px rgba(0, 0, 0, 0.25)',
  md: '0 4px 12px rgba(0, 0, 0, 0.30)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.40)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.50)',
  // overlays especiales
  brand: '0 0 0 1px rgba(212, 160, 23, 0.20), 0 1px 2px rgba(212, 160, 23, 0.10)',
  focus: '0 0 0 2px #08090A, 0 0 0 4px rgba(212, 160, 23, 0.40)',
};

// ============================================
// Motion — duraciones cortas, easing funcional
// ============================================
export const ease = {
  // No "luxury" 1600ms BS. Usuarios necesitan feedback rápido.
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const duration = {
  instant: '80ms',     // hover, focus
  fast: '160ms',       // default UI
  base: '240ms',       // transiciones complejas
  slow: '400ms',       // enter/exit
  slower: '600ms',     // cinematográfico (raro)
};

// ============================================
// z-index scale
// ============================================
export const z = {
  base: 0,
  raised: 10,
  sticky: 20,
  dropdown: 30,
  drawer: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
};
