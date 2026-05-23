// ============================================
// Section - contenedor premium con título eyebrow + opcional action
// ============================================

interface SectionProps {
  eyebrow?: string;
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'gold';
  noPadding?: boolean;
}

export function Section({
  eyebrow,
  title,
  action,
  children,
  className = '',
  variant = 'default',
  noPadding = false,
}: SectionProps) {
  const bg =
    variant === 'gold'
      ? 'linear-gradient(180deg, rgba(191,163,99,0.04) 0%, rgba(191,163,99,0.02) 100%)'
      : variant === 'subtle'
      ? 'rgba(255,255,255,0.02)'
      : 'linear-gradient(180deg, rgba(15,25,42,0.7) 0%, rgba(10,16,28,0.85) 100%)';

  const border =
    variant === 'gold'
      ? '1px solid rgba(191,163,99,0.15)'
      : '1px solid rgba(255,255,255,0.06)';

  return (
    <section
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{ background: bg, border, boxShadow: '0 4px 16px rgba(8,14,26,0.15)' }}
    >
      {/* Edge dorado superior sutil */}
      {variant === 'gold' && (
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,185,120,0.3), transparent)' }}
        />
      )}

      {(eyebrow || title || action) && (
        <header className={`flex items-center justify-between gap-3 ${noPadding ? 'px-5 pt-5' : 'p-5 pb-3'}`}>
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p
                className="text-[10px] font-semibold mb-1"
                style={{
                  color: 'rgba(191,163,99,0.55)',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow}
              </p>
            )}
            {title && (
              <h2
                className="leading-tight"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.95)',
                  letterSpacing: '-0.005em',
                }}
              >
                {title}
              </h2>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}

      <div className={noPadding ? '' : 'px-5 pb-5'}>{children}</div>
    </section>
  );
}

export default Section;
