import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Afterfact — Stale-Answer Detector',
  description: 'Evidence-grounded temporal fact verification for AI-generated answers',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
