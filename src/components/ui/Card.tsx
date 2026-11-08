'use client';

import React from 'react';

export type CardVariant = 'default' | 'raised' | 'subtle';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
}

export function Card({
  variant = 'default',
  className = '',
  children,
  ...props
}: CardProps) {
  const variants: Record<CardVariant, string> = {
    default: 'bg-surface border border-border-subtle shadow-sm',
    raised: 'bg-surface-raised border border-border-subtle shadow-sm',
    subtle: 'bg-surface/60 border border-border-subtle',
  };

  return (
    <div
      className={`rounded-lg p-5 transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 pb-3 border-b border-border-subtle mb-4 ${className}`}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-text-primary tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
