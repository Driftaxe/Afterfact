import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Afterfact — Stale-Answer Detector',
  description: 'Evidence-grounded temporal fact verification for AI-generated answers',
};

// Inline script executed synchronously before first paint to prevent theme flash
const themeInitializerScript = `(function(){
  try {
    var key = 'afterfact-theme';
    var stored = localStorage.getItem(key);
    var theme = (stored === 'light' || stored === 'dark') ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializerScript }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-text-primary font-sans antialiased flex flex-col overflow-x-hidden`}>
        <ThemeProvider>
          <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-6">
                <Link
                  href="/"
                  className="text-sm font-medium tracking-tight text-text-primary hover:text-text-secondary transition-colors"
                >
                  Afterfact
                </Link>
                <nav className="flex items-center gap-4 text-xs font-medium">
                  <Link
                    href="/design"
                    className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span>Design Reference</span>
                    <span className="hidden sm:inline-block rounded-md bg-surface-raised px-1.5 py-0.5 text-[10px] text-text-muted">
                      /design
                    </span>
                  </Link>
                </nav>
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle />
              </div>
            </div>
          </header>

          <div className="flex-1">
            {children}
          </div>

          <footer className="border-t border-border-subtle bg-surface/30 py-6 text-center text-xs text-text-muted">
            <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p>Afterfact — Evidence-grounded temporal fact verification</p>
              <p className="font-mono text-[11px]">Quiet, cinematic, precise.</p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
