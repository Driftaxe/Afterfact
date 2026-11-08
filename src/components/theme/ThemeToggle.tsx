'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark';
  const nextActionLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-hydrated={mounted ? 'true' : undefined}
      aria-label={nextActionLabel}
      title={nextActionLabel}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-raised hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${className}`}
    >
      {isDark ? (
        // Moon icon for dark mode
        <svg
          className="h-4 w-4 text-accent"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ) : (
        // Sun icon for light mode
        <svg
          className="h-4 w-4 text-accent"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      )}

      {showLabel ? (
        <span className="capitalize">{theme}</span>
      ) : (
        <span className="sr-only">{nextActionLabel}</span>
      )}
    </button>
  );
}
