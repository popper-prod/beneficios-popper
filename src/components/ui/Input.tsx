import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

// ============================================
// Input — focus ring brand sutil, sin gradientes
// ============================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftIcon, rightAddon, style, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-2)',
              marginBottom: 6,
            }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-3)',
                pointerEvents: 'none',
                display: 'flex',
              }}
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full font-medium ${className}`}
            style={{
              height: '36px',
              padding: leftIcon ? '0 12px 0 36px' : rightAddon ? '0 40px 0 12px' : '0 12px',
              background: 'var(--bg-elevated)',
              border: error ? '1px solid var(--danger-border)' : '1px solid var(--border-default)',
              borderRadius: '6px',
              color: 'var(--text-1)',
              fontSize: '13px',
              outline: 'none',
              transition: 'all 120ms cubic-bezier(0.4, 0, 0.2, 1)',
              ...style,
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--brand)';
              e.target.style.boxShadow = '0 0 0 3px var(--brand-subtle)';
              props.onFocus?.(e);
            }}
            onBlur={e => {
              e.target.style.borderColor = error ? 'var(--danger-border)' : 'var(--border-default)';
              e.target.style.boxShadow = 'none';
              props.onBlur?.(e);
            }}
            {...props}
          />
          {rightAddon && (
            <div
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              {rightAddon}
            </div>
          )}
        </div>
        {hint && !error && (
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 4 }}>{hint}</p>
        )}
        {error && (
          <p style={{ fontSize: '11px', color: 'var(--danger-text)', marginTop: 4 }}>{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
