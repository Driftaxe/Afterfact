import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[calc(100vh-8.5rem)] flex items-center justify-center px-4 sm:px-6 pt-20 pb-16">
      <div className="max-w-md w-full text-center space-y-5 p-8 rounded-xl border border-border-subtle bg-surface/60 backdrop-blur-xs shadow-xs">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-raised border border-border-subtle text-text-muted font-mono text-sm">
          404
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-sans font-normal tracking-heading text-text-primary">
            Page Not Found
          </h1>
          <p className="text-xs font-mono text-text-secondary leading-relaxed">
            The requested resource, report snapshot, or endpoint does not exist or may have expired.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-9 px-5 rounded-xs bg-[#E8E1DA] hover:bg-[#F4F4F0] text-[#111215] font-mono text-xs uppercase tracking-wider font-semibold transition-all shadow-xs"
          >
            Return Home &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
