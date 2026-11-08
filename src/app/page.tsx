import React from 'react';
import { InputComposer } from '@/components/composer/InputComposer';

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-8.5rem)] px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-heading text-text-primary">
            Clarity, even as facts change.
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-[1.6] max-w-lg mx-auto">
            Check AI-generated answers against current web sources to detect outdated,
            contradicted, or unverified claims.
          </p>
        </div>

        <InputComposer showSampleLink={true} />
      </div>
    </main>
  );
}
