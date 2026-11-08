'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'afterfact-theme';

export function resolveValidTheme(value: string | null | undefined): Theme {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return 'dark';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return resolveValidTheme(stored);
  } catch {
    // If localStorage access throws (e.g. security policy, private mode), gracefully fallback to dark
    return 'dark';
  }
}

function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Graceful degradation when storage is unavailable
  }
}

function applyThemeToDom(theme: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    // Sync with DOM attribute (already initialized by inline script) or localStorage
    const initial = getStoredTheme();
    setThemeState(initial);
    applyThemeToDom(initial);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    const valid = resolveValidTheme(nextTheme);
    setThemeState(valid);
    applyThemeToDom(valid);
    setStoredTheme(valid);
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
