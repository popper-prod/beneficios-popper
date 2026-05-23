import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

// ============================================
// Button — shadcn/ui inspirado, denso, funcional
// ============================================

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--brand)',
    color: 'var(--brand-fg)',
    border: '1px solid var(--brand)',
  },
  secondary: {
    background: 'var(--bg-raised)',
    color: 'var(--text-1)',
    border: '1px solid var(--border-default)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-2)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-1)',
    border: '1px solid var(--border-default)',
  },
  danger: {
    background: 'var(--danger-bg)',
    color: 'var(--danger-text)',
    border: '1px solid var(--danger-border)',
  },
  success: {
    background: 'var(--success-bg)',
    color: 'var(--success-text)',
    border: '1px solid var(--success-border)',
  },
};

const sizeStyles: Record<Size, { padding: string; fontSize: string; height: string; gap: string }> = {
  sm: { padding: '0 8px', fontSize: '12px', height: '28px', gap: '4px' },
  md: { padding: '0 12px', fontSize: '13px', height: '32px', gap: '6px' },
  lg: { padding: '0 16px', fontSize: '14px', height: '40px', gap: '8px' },
  icon: { padding: '0', fontSize: '13px', height: '32px', gap: '0' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, children, style, disabled, className = '', ...props }, ref) => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];
    const isIcon = size === 'icon';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium rounded-md transition-all whitespace-nowrap select-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        style={{
          ...variantStyle,
          ...sizeStyle,
          width: isIcon ? sizeStyle.height : undefined,
          transitionDuration: '120ms',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          ...style,
        }}
        onMouseEnter={e => {
          if (disabled || loading) return;
          if (variant === 'primary') e.currentTarget.style.background = 'var(--brand-hover)';
          else if (variant === 'ghost') e.currentTarget.style.background = 'var(--bg-elevated)';
          else if (variant === 'secondary') e.currentTarget.style.background = 'var(--bg-elevated)';
          else if (variant === 'outline') e.currentTarget.style.background = 'var(--bg-elevated)';
          else if (variant === 'danger') {
            e.currentTarget.style.background = 'var(--danger)';
            e.currentTarget.style.color = 'white';
          } else if (variant === 'success') {
            e.currentTarget.style.background = 'var(--success)';
            e.currentTarget.style.color = 'white';
          }
        }}
        onMouseLeave={e => {
          Object.assign(e.currentTarget.style, variantStyle);
        }}
        {...props}
      >
        {loading ? (
          <Spinner size={isIcon ? 14 : 13} />
        ) : (
          <>
            {leftIcon && <span style={{ marginRight: children ? sizeStyle.gap : 0, display: 'inline-flex' }}>{leftIcon}</span>}
            {children}
            {rightIcon && <span style={{ marginLeft: children ? sizeStyle.gap : 0, display: 'inline-flex' }}>{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg
      style={{ width: size, height: size, animation: 'spin 600ms linear infinite' }}
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default Button;
