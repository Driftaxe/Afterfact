import React from 'react';
import { HeroSection } from '@/components/landing/HeroSection';
import { IntroductionSection } from '@/components/landing/IntroductionSection';
import { PipelineSection } from '@/components/landing/PipelineSection';
import { EvidenceSection } from '@/components/landing/EvidenceSection';
import { TemporalSection } from '@/components/landing/TemporalSection';
import { ApplicationPreview } from '@/components/landing/ApplicationPreview';
import { ProjectShowcase } from '@/components/landing/ProjectShowcase';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* SECTION 01: Hero Section — Video-First Cinematic Experience & Split Navigation */}
      <HeroSection />

      {/* SECTION 02: Product Introduction — "Answers are easy. Verifying them is harder." */}
      <IntroductionSection />

      {/* SECTION 03: How It Works — 5-Stage Persisted DAG Pipeline */}
      <PipelineSection />

      {/* SECTION 04: Evidence Intelligence — Relational Provenance Graph */}
      <EvidenceSection />

      {/* SECTION 05: Temporal Intelligence — Verdict Taxonomy & Then vs Now Case Study */}
      <TemporalSection />

      {/* SECTION 06: Application Preview — Polished Preview with Route to /app */}
      <ApplicationPreview />

      {/* SECTION 07: Project & Engineering — Public Repository, Contributors, Real Metrics */}
      <ProjectShowcase />

      {/* SECTION 08: Minimal Editorial Institutional Footer */}
      <Footer />
    </main>
  );
}
