'use client';

import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      description,
      error,
      required = false,
      disabled = false,
      readOnly = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const descriptionId = description ? `${inputId}-desc` : undefined;
    const errorId = error ? `${inputId}-err` : undefined;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-primary"
          >
            {label}
            {required && <span className="ml-1 text-accent" aria-hidden="true">*</span>}
          </label>
        )}

        {description && (
          <p id={descriptionId} className="text-xs text-text-secondary">
            {description}
          </p>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-describedby={descriptionId}
          aria-invalid={error ? 'true' : undefined}
          aria-errormessage={errorId}
          className={`w-full h-10 rounded-[9px] border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-surface-raised ${
            error
              ? 'border-status-contradicted-border focus-visible:ring-status-contradicted-text'
              : 'border-border-subtle hover:border-border-strong focus:border-border-strong'
          } ${className}`}
          {...props}
        />

        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs font-medium text-status-contradicted-text"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
