'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import type { SharedContext } from '@/lib/contracts/request';

export interface ContextFieldsProps {
  context: SharedContext;
  onChange: (context: SharedContext) => void;
  disabled?: boolean;
}

export function ContextFields({ context, onChange, disabled }: ContextFieldsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleFieldChange = (field: keyof SharedContext, value: string) => {
    onChange({
      ...context,
      [field]: value.trim().length > 0 ? value : undefined,
    });
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface/50 p-4 transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-text-primary hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-md py-1"
        aria-expanded={isOpen}
        aria-controls="context-fields-panel"
      >
        <span className="flex items-center gap-2">
          <span>Add context</span>
          <span className="text-xs text-text-muted font-normal">— optional</span>
        </span>
        <svg
          className={`h-4 w-4 text-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div id="context-fields-panel" className="mt-4 space-y-3 pt-3 border-t border-border-subtle">
          <p className="text-xs text-text-muted">
            Explicit qualifiers in claim text take precedence. You can start without context;
            the live preparation pipeline will infer or request relevant qualifiers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Target Date (YYYY-MM-DD)"
              placeholder="e.g. 2024-09-01"
              value={context.targetDate || ''}
              onChange={(e) => handleFieldChange('targetDate', e.target.value)}
              disabled={disabled}
              description="Evaluation reference date"
            />
            <Input
              label="Jurisdiction / Region"
              placeholder="e.g. US, EU, California"
              value={context.jurisdiction || context.region || ''}
              onChange={(e) => handleFieldChange('jurisdiction', e.target.value)}
              disabled={disabled}
              description="Legal or regional boundary"
            />
            <Input
              label="Currency"
              placeholder="e.g. USD, EUR, GBP"
              value={context.currency || ''}
              onChange={(e) => handleFieldChange('currency', e.target.value)}
              disabled={disabled}
              description="Billing or price currency"
            />
            <Input
              label="Software / API Version"
              placeholder="e.g. v2, 2024-05"
              value={context.version || ''}
              onChange={(e) => handleFieldChange('version', e.target.value)}
              disabled={disabled}
              description="SDK or API specification version"
            />
          </div>
        </div>
      )}
    </div>
  );
}
