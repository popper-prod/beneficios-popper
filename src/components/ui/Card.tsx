import { ReactNode } from 'react';

// ============================================
// Card — superficie base, sin decoración
// ============================================

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const padMap = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
};

export function Card({ children, className = '', hover = false, padding = 'md', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: padMap[padding],
        cursor: onClick ? 'pointer' : undefined,
        transition: 'all 120ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={hover ? e => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.borderColor = 'var(--border-default)'; } : undefined}
      onMouseLeave={hover ? e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function CardHeader({ title, description, action, children }: CardHeaderProps) {
  if (children) return <div className="mb-4">{children}</div>;
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0 flex-1">
        {title && (
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.005em' }}>
            {title}
          </h3>
        )}
        {description && (
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 4 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export default Card;
