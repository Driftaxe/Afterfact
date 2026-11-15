import React from 'react';
import { InputComposer } from '@/components/composer/InputComposer';

export const metadata = {
  title: 'Verification Workspace — Afterfact',
  description: 'Submit AI-generated answers or questions to decompose into verifiable atomic claims with temporal provenance.',
};

export default function AppPage() {
  return (
    <div className="w-full min-h-screen pt-28 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto flex flex-col justify-start">
      {/* Workspace Header */}
      <div className="mb-8 space-y-2 border-b border-border-subtle/80 pb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle text-[10px] font-mono tracking-widest uppercase text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
          <span>LIVE VERIFICATION ENGINE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-text-primary">
          Verification Workspace
        </h1>
        <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
          Submit AI-generated text or questions to decompose into verifiable atomic claims, retrieve primary authority evidence, and detect temporal drift.
        </p>
      </div>

      {/* Main Interactive Input Composer */}
      <div className="w-full">
        <InputComposer />
      </div>
    </div>
  );
}
