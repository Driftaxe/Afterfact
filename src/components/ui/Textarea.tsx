'use client';

import React, { useId } from 'react';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  showCount?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id,
      label,
      description,
      error,
      required = false,
      disabled = false,
      readOnly = false,
      showCount = false,
      maxLength,
      value,
      defaultValue,
      className = '',
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const descriptionId = description ? `${textareaId}-desc` : undefined;
    const errorId = error ? `${textareaId}-err` : undefined;

    const controlledLength = typeof value === 'string' ? value.length : undefined;
    const [uncontrolledLength, setUncontrolledLength] = React.useState<number>(() => {
      if (typeof defaultValue === 'string') return defaultValue.length;
      return 0;
    });
    const currentLength = controlledLength !== undefined ? controlledLength : uncontrolledLength;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (controlledLength === undefined) {
        setUncontrolledLength(e.target.value.length);
      }
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <div className="w-full space-y-1.5 text-left">
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={textareaId}
              className="block text-sm font-medium text-text-primary"
            >
              {label}
              {required && <span className="ml-1 text-accent" aria-hidden="true">*</span>}
            </label>
          )}
          {showCount && maxLength && (
            <span id={`${textareaId}-count`} className="text-xs text-text-muted font-mono">
              {currentLength} / {maxLength}
            </span>
          )}
        </div>

        {description && (
          <p id={descriptionId} className="text-xs text-text-secondary">
            {description}
          </p>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          aria-describedby={descriptionId}
          aria-invalid={error ? 'true' : undefined}
          aria-errormessage={errorId}
          className={`w-full rounded-[9px] border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-surface-raised min-h-[96px] ${
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

Textarea.displayName = 'Textarea';
