'use client';

import React, { useId } from 'react';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      id,
      label,
      description,
      error,
      disabled = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;
    const descriptionId = description ? `${checkboxId}-desc` : undefined;
    const errorId = error ? `${checkboxId}-err` : undefined;

    return (
      <div className="space-y-1 text-left">
        <label
          htmlFor={checkboxId}
          className={`flex items-start gap-2.5 cursor-pointer ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          } ${className}`}
        >
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            disabled={disabled}
            aria-describedby={descriptionId}
            aria-invalid={error ? 'true' : undefined}
            aria-errormessage={errorId}
            className="mt-0.5 h-4 w-4 rounded-sm border border-border-strong bg-surface text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring checked:bg-accent checked:border-accent"
            {...props}
          />
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-text-primary select-none">
              {label}
            </span>
            {description && (
              <p id={descriptionId} className="text-xs text-text-secondary">
                {description}
              </p>
            )}
          </div>
        </label>

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

Checkbox.displayName = 'Checkbox';
