import React from 'react';
import { HeroSection } from '@/components/landing/HeroSection';
import { IntroductionSection } from '@/components/landing/IntroductionSection';
import { PipelineSection } from '@/components/landing/PipelineSection';
import { EvidenceSection } from '@/components/landing/EvidenceSection';
import { TemporalSection } from '@/components/landing/TemporalSection';
import { WorkspaceSection } from '@/components/landing/WorkspaceSection';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* Cinematic Editorial Hero with Asymmetric Floating Cards & Story Rail */}
      <HeroSection />

      {/* Section A: Institutional Product Introduction & Split Architecture Manifesto */}
      <IntroductionSection />

      {/* Section B: How Verification Works — 5-Stage Persisted DAG Pipeline */}
      <PipelineSection />

      {/* Section C: Evidence Intelligence & Provenance Graph Invariants */}
      <EvidenceSection />

      {/* Section D: Temporal Intelligence & Case Study Verdict Taxonomy */}
      <TemporalSection />

      {/* Section E: Interactive Verification Workspace hosting InputComposer */}
      <WorkspaceSection />

      {/* Editorial Institutional Footer */}
      <Footer />
    </main>
  );
}
