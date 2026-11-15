import type { Metadata } from 'next';
import { Geist, Geist_Mono, Newsreader } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { FloatingNav } from '@/components/landing/FloatingNav';

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

const newsreader = Newsreader({
  variable: '--font-serif',
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Afterfact — Temporal Evidence Intelligence',
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} min-h-screen bg-background text-text-primary font-sans antialiased flex flex-col overflow-x-hidden selection:bg-selection`}>
        <ThemeProvider>
          {/* Distinctive Floating Navigation with Rising Triangular Emblem */}
          <FloatingNav />

          <div className="flex-1 flex flex-col w-full">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
