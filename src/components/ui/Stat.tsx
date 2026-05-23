import { useEffect, useState, useRef } from 'react';

// ============================================
// Stat - KPI card premium con número animado
// Filosofía: cifra grande en serif + label en eyebrow + delta opcional
// ============================================

interface StatProps {
  label: string;
  value: number | string;
  delta?: { value: number; label?: string }; // ej: +12% vs mes pasado
  icon?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  variant?: 'default' | 'gold' | 'subtle';
  trend?: number[]; // sparkline data (opcional)
  loading?: boolean;
}

// Animar número desde 0 hasta el valor target con easing luxury
function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const initial = value;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo - cubic-bezier(0.16, 1, 0.3, 1)
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(initial + (target - initial) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);

  return value;
}

export function Stat({
  label,
  value,
  delta,
  icon,
  prefix = '',
  suffix = '',
  decimals = 0,
  variant = 'default',
  trend,
  loading = false,
}: StatProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const animated = useCountUp(numericValue, 1200, typeof value === 'number' && !loading);

  const displayValue = typeof value === 'string'
    ? value
    : animated.toLocaleString('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  const goldGlow = variant === 'gold';
  const subtle = variant === 'subtle';

  return (
    <div
      className="relative group"
      style={{
        background: subtle ? 'rgba(255,255,255,0.02)' : 'linear-gradient(180deg, rgba(15,25,42,0.85) 0%, rgba(10,16,28,0.95) 100%)',
        border: `1px solid ${goldGlow ? 'rgba(191,163,99,0.25)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '14px',
        padding: '24px',
        transition: 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: goldGlow
          ? '0 0 40px rgba(191,163,99,0.08), inset 0 1px 0 rgba(212,185,120,0.08)'
          : '0 4px 16px rgba(8,14,26,0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Glow sutil al pasar el mouse */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(191,163,99,0.06), transparent 70%)',
        }}
      />

      {/* Header con eyebrow + icon */}
      <div className="relative flex items-start justify-between mb-4">
        <p
          className="text-[10px] font-semibold uppercase"
          style={{
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.22em',
          }}
        >
          {label}
        </p>
        {icon && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(191,163,99,0.06)',
              border: '1px solid rgba(191,163,99,0.12)',
              color: '#bfa363',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Cifra principal */}
      <div className="relative flex items-baseline gap-2 mb-1">
        {loading ? (
          <div className="skeleton h-10 w-24" />
        ) : (
          <h3
            className="leading-none"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '36px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum" 1, "lnum" 1',
              letterSpacing: '-0.02em',
            }}
          >
            {prefix}
            {displayValue}
            {suffix}
          </h3>
        )}
      </div>

      {/* Delta + sparkline */}
      {(delta || trend) && (
        <div className="relative flex items-center justify-between mt-3">
          {delta && !loading && (
            <div className="flex items-center gap-1.5">
              <span
                className="text-[11px] font-semibold"
                style={{
                  color: delta.value >= 0 ? '#7fc99f' : '#e89089',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {delta.value >= 0 ? '↗' : '↘'} {Math.abs(delta.value)}%
              </span>
              {delta.label && (
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {delta.label}
                </span>
              )}
            </div>
          )}
          {trend && trend.length > 1 && <Sparkline data={trend} />}
        </div>
      )}
    </div>
  );
}

// Mini sparkline SVG inline (sin recharts para mantenerlo liviano)
export function Sparkline({ data, color = '#bfa363' }: { data: number[]; color?: string }) {
  const w = 80;
  const h = 24;
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
      <polygon fill={`url(#spark-${color})`} points={`0,${h} ${points} ${w},${h}`} />
    </svg>
  );
}

export default Stat;
