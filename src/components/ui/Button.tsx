'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      iconOnly = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // Base styles
    const base =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50 select-none';

    // Size styles
    const sizes: Record<ButtonSize, string> = {
      sm: iconOnly ? 'h-8 w-8 rounded-lg' : 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: iconOnly ? 'h-10 w-10 rounded-[9px]' : 'h-10 px-4 text-sm rounded-[9px] gap-2',
      lg: iconOnly ? 'h-11 w-11 rounded-[9px]' : 'h-11 px-5 text-sm sm:text-base rounded-[9px] gap-2.5',
    };

    // Variant styles
    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover shadow-sm active:opacity-95',
      secondary:
        'border border-border-subtle bg-surface text-text-primary hover:bg-surface-raised hover:border-border-strong active:bg-surface-raised',
      quiet:
        'text-text-secondary hover:text-text-primary hover:bg-surface-raised active:bg-surface',
      destructive:
        'bg-status-contradicted-bg text-status-contradicted-text border border-status-contradicted-border hover:opacity-90 active:opacity-100',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading ? 'true' : undefined}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className={loading ? 'opacity-80' : ''}>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
