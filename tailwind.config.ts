import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic Token System
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'border-subtle': 'var(--color-border-subtle)',
        'border-strong': 'var(--color-border-strong)',
        'btn-primary': {
          DEFAULT: 'var(--color-btn-primary-bg)',
          text: 'var(--color-btn-primary-text)',
          hover: 'var(--color-btn-primary-hover)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          foreground: 'var(--color-accent-foreground)',
        },
        'focus-ring': 'var(--color-focus-ring)',
        selection: 'var(--color-selection)',
        overlay: 'var(--color-overlay)',

        // Status Tokens
        status: {
          'supported-bg': 'var(--status-supported-bg)',
          'supported-text': 'var(--status-supported-text)',
          'supported-border': 'var(--status-supported-border)',
          'outdated-bg': 'var(--status-outdated-bg)',
          'outdated-text': 'var(--status-outdated-text)',
          'outdated-border': 'var(--status-outdated-border)',
          'contradicted-bg': 'var(--status-contradicted-bg)',
          'contradicted-text': 'var(--status-contradicted-text)',
          'contradicted-border': 'var(--status-contradicted-border)',
          'unresolved-bg': 'var(--status-unresolved-bg)',
          'unresolved-text': 'var(--status-unresolved-text)',
          'unresolved-border': 'var(--status-unresolved-border)',
          'checking-bg': 'var(--status-checking-bg)',
          'checking-text': 'var(--status-checking-text)',
          'checking-border': 'var(--status-checking-border)',
        },

        // Legacy compatibility tokens
        ink: 'var(--color-ink)',
        paper: 'var(--color-paper)',
        panel: 'var(--color-panel)',
        line: 'var(--color-line)',
      },
      letterSpacing: {
        heading: '-0.035em',
        tight: '-0.025em',
        normal: '0em',
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'var(--font-mono)',
          '"SF Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
        lg: '0 12px 28px 0 rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
