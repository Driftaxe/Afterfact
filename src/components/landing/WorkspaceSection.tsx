import React from 'react';
import { InputComposer } from '@/components/composer/InputComposer';

export function WorkspaceSection() {
  return (
    <section id="workspace" className="py-24 sm:py-32 border-b border-border-subtle relative scroll-mt-20">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-accent/5 rounded-full blur-3xl opacity-60" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Workspace Section Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-border-subtle text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            <span>INTERACTIVE VERIFICATION WORKSPACE</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-text-primary leading-[1.1]">
            Verify an answer in real time.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            Paste any AI response or pose a research question. The verifier parses discrete claims, anchors context
            parameters, and traces every statement against authoritative web documentation.
          </p>
        </div>

        {/* Framing Container for the Existing InputComposer Component */}
        <div className="relative">
          <div className="absolute -inset-1.5 bg-gradient-to-b from-border-strong/50 via-border-subtle/30 to-border-strong/40 rounded-3xl blur-sm -z-10" />
          <div className="rounded-2xl bg-surface/95 dark:bg-[#18191C]/95 border border-border-strong p-4 sm:p-8 shadow-2xl backdrop-blur-xl">
            <InputComposer showSampleLink={true} />
          </div>
        </div>

        {/* Privacy & Provenance Assurance Notice */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-text-muted px-2">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
            Runs partitioned by cryptographic owner hash
          </span>
          <span>Zero training on submitted inputs · Ephemeral storage</span>
        </div>
      </div>
    </section>
  );
}
