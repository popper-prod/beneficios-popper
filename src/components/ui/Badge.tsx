import { ReactNode } from 'react';

// ============================================
// Badge — pequeño, denso, con dot opcional
// ============================================

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';

interface BadgeProps {
  tone?: Tone;
  size?: 'sm' | 'md';
  dot?: boolean;
  children: ReactNode;
}

const tones: Record<Tone, { bg: string; border: string; text: string; dot: string }> = {
  neutral: {
    bg: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.12)',
    text: 'var(--text-2)',
    dot: 'var(--text-3)',
  },
  brand: {
    bg: 'var(--brand-muted)',
    border: 'var(--brand-border)',
    text: 'var(--brand)',
    dot: 'var(--brand)',
  },
  success: {
    bg: 'var(--success-bg)',
    border: 'var(--success-border)',
    text: 'var(--success-text)',
    dot: 'var(--success)',
  },
  danger: {
    bg: 'var(--danger-bg)',
    border: 'var(--danger-border)',
    text: 'var(--danger-text)',
    dot: 'var(--danger)',
  },
  warning: {
    bg: 'var(--warning-bg)',
    border: 'var(--warning-border)',
    text: 'var(--warning-text)',
    dot: 'var(--warning)',
  },
  info: {
    bg: 'var(--info-bg)',
    border: 'var(--info-border)',
    text: 'var(--info-text)',
    dot: 'var(--info)',
  },
};

export function Badge({ tone = 'neutral', size = 'md', dot, children }: BadgeProps) {
  const t = tones[tone];
  const isSmall = size === 'sm';

  return (
    <span
      className="inline-flex items-center font-medium rounded-md"
      style={{
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.border}`,
        padding: isSmall ? '1px 6px' : '2px 8px',
        fontSize: isSmall ? '10.5px' : '11.5px',
        lineHeight: 1.4,
        gap: 6,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: t.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// Tier badge específico para niveles de colaborador
type Tier = 'bronce' | 'plata' | 'oro' | 'platinum';

const tierStyles: Record<Tier, { bg: string; color: string; border: string; label: string }> = {
  bronce: {
    bg: 'rgba(185, 120, 66, 0.10)',
    color: '#cd8d57',
    border: 'rgba(185, 120, 66, 0.25)',
    label: 'Bronce',
  },
  plata: {
    bg: 'rgba(148, 163, 184, 0.10)',
    color: '#cbd5e1',
    border: 'rgba(148, 163, 184, 0.25)',
    label: 'Plata',
  },
  oro: {
    bg: 'rgba(212, 160, 23, 0.12)',
    color: '#e0ad22',
    border: 'rgba(212, 160, 23, 0.30)',
    label: 'Oro',
  },
  platinum: {
    bg: 'rgba(228, 228, 231, 0.08)',
    color: '#f4f4f5',
    border: 'rgba(228, 228, 231, 0.25)',
    label: 'Platinum',
  },
};

export function TierBadge({ tier }: { tier: string }) {
  const t = tierStyles[tier as Tier] || tierStyles.bronce;
  return (
    <span
      className="inline-flex items-center font-medium rounded-md"
      style={{
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        padding: '1px 6px',
        fontSize: '10.5px',
        lineHeight: 1.4,
      }}
    >
      {t.label}
    </span>
  );
}

export default Badge;
