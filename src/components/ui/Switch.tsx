'use client';

import React, { useId } from 'react';

export interface SwitchProps {
  id?: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className = '',
}: SwitchProps) {
  const generatedId = useId();
  const switchId = id || generatedId;
  const descriptionId = description ? `${switchId}-desc` : undefined;

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={`flex items-start justify-between gap-4 text-left ${className}`}>
      <div className="space-y-0.5">
        <label
          htmlFor={switchId}
          id={`${switchId}-label`}
          className={`text-sm font-medium text-text-primary cursor-pointer select-none ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          }`}
          onClick={handleClick}
        >
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-xs text-text-secondary">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        aria-labelledby={`${switchId}-label`}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-accent' : 'bg-surface-raised border-border-strong'
        }`}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
