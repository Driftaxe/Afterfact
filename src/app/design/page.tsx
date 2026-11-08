'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Card,
  CardHeader,
  Divider,
  StatusBadge,
  InlineError,
  Notice,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { InputComposer } from '@/components/composer/InputComposer';
import {
  ReportLoadingSkeleton,
  ReportEmptyClaimsState,
  ReportErrorState,
  ReportPartialBanner,
} from '@/components/report/ReportStates';

export default function DesignReferencePage() {
  const { theme } = useTheme();

  // Local interactive demo states
  const [buttonLoading, setButtonLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Form demo states
  const [demoInput, setDemoInput] = useState('');
  const [demoTextarea, setDemoTextarea] = useState(
    'Stripe charges a 2.9% + 30¢ flat fee for standard credit card transactions in the US.'
  );
  const [demoSelect, setDemoSelect] = useState('us');
  const [demoCheckbox, setDemoCheckbox] = useState(true);
  const [demoSwitch, setDemoSwitch] = useState(false);
  const [formErrors, setFormErrors] = useState<{ input?: string; textarea?: string }>({});
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Claim sample expand state
  const [claimExpanded, setClaimExpanded] = useState(true);

  // Error retry demo state
  const [retryState, setRetryState] = useState<'error' | 'retrying' | 'resolved'>('error');

  const handleDemoFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { input?: string; textarea?: string } = {};

    if (!demoInput.trim()) {
      errors.input = 'Question or topic title is required.';
    } else if (demoInput.length < 5) {
      errors.input = 'Please enter at least 5 characters.';
    }

    if (!demoTextarea.trim()) {
      errors.textarea = 'Answer text to verify is required.';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length === 0) {
      setFormSubmitted(true);
    } else {
      setFormSubmitted(false);
    }
  };

  const handleResetForm = () => {
    setDemoInput('');
    setDemoTextarea('Stripe charges a 2.9% + 30¢ flat fee for standard credit card transactions in the US.');
    setDemoSelect('us');
    setDemoCheckbox(true);
    setDemoSwitch(false);
    setFormErrors({});
    setFormSubmitted(false);
  };

  const handleSimulateRetry = () => {
    setRetryState('retrying');
    setTimeout(() => {
      setRetryState('resolved');
    }, 800);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12 overflow-x-hidden">
      {/* ====================================================================
          Section A: Header & Visual Introduction
          ==================================================================== */}
      <section className="space-y-6 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Design Reference / Sample Content</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-normal tracking-heading text-text-primary">
              Afterfact — Design Reference
            </h1>
            <p className="text-sm sm:text-base text-text-secondary max-w-2xl leading-relaxed">
              Quiet, cinematic, precise. An evidence-grounded design system inspired by deliberate editorial typography, graphite surfaces, and quiet contrast.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">Theme:</span>
            <ThemeToggle showLabel />
          </div>
        </div>

        {/* Disclaimer Callout */}
        <Notice title="Illustrative Sample Notice">
          All claims, verdict states, dates, and evidence snippets displayed on this page are
          fictional test fixtures intended strictly for visual reference and design inspection.
          No live web retrieval or external verification has occurred on this route.
        </Notice>

        {/* Section Anchor Navigation */}
        <nav
          aria-label="Design Reference Sections"
          className="flex flex-wrap items-center gap-2 pt-2 text-xs font-medium"
        >
          <span className="text-text-muted mr-1">Jump to:</span>
          {[
            { href: '#foundations', label: 'Foundations' },
            { href: '#buttons', label: 'Buttons & States' },
            { href: '#forms', label: 'Form Controls' },
            { href: '#status', label: 'Verification Badges' },
            { href: '#product-samples', label: 'Product Samples' },
            { href: '#process', label: 'Process & Feedback' },
            { href: '#usage', label: 'Component Usage' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md border border-border-subtle bg-surface px-2.5 py-1 text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </section>

      {/* ====================================================================
          Section B: Foundations (Tokens, Swatches & Typography)
          ==================================================================== */}
      <section id="foundations" className="space-y-6 text-left">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">1. Visual Foundations</h2>
          <p className="text-xs text-text-secondary">
            Semantic color tokens, active theme values, typography scale, and elevation.
          </p>
        </div>

        <Card variant="default" className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Theme Palette ({theme === 'dark' ? 'Dark Mode — Primary' : 'Light Mode — Secondary'})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                {
                  name: 'Background',
                  token: '--color-background',
                  darkHex: '#111214',
                  lightHex: '#F7F5F0',
                  bgClass: 'bg-background',
                  border: true,
                },
                {
                  name: 'Surface',
                  token: '--color-surface',
                  darkHex: '#18191C',
                  lightHex: '#FFFFFF',
                  bgClass: 'bg-surface',
                  border: true,
                },
                {
                  name: 'Surface Raised',
                  token: '--color-surface-raised',
                  darkHex: '#202125',
                  lightHex: '#EDE8DF',
                  bgClass: 'bg-surface-raised',
                  border: true,
                },
                {
                  name: 'Primary Text',
                  token: '--color-text-primary',
                  darkHex: '#E7E5E2',
                  lightHex: '#1A1B1E',
                  bgClass: 'bg-text-primary',
                  border: false,
                },
                {
                  name: 'Secondary Text',
                  token: '--color-text-secondary',
                  darkHex: '#AAA8A5',
                  lightHex: '#5A5854',
                  bgClass: 'bg-text-secondary',
                  border: false,
                },
                {
                  name: 'Muted Text',
                  token: '--color-text-muted',
                  darkHex: '#85858D',
                  lightHex: '#787570',
                  bgClass: 'bg-text-muted',
                  border: false,
                },
                {
                  name: 'Border Subtle',
                  token: '--color-border-subtle',
                  darkHex: '#2B2D32',
                  lightHex: '#E8E3DA',
                  bgClass: 'bg-border-subtle',
                  border: true,
                },
                {
                  name: 'Primary CTA',
                  token: '--color-btn-primary-bg',
                  darkHex: '#DEDBD6',
                  lightHex: '#1A1B1E',
                  bgClass: 'bg-btn-primary text-btn-primary-text',
                  border: true,
                },
                {
                  name: 'Accent (Secondary)',
                  token: '--color-accent',
                  darkHex: '#B5AEBD',
                  lightHex: '#5C4E68',
                  bgClass: 'bg-accent',
                  border: false,
                },
                {
                  name: 'Supported',
                  token: '--status-supported',
                  darkHex: '#9CD7B4',
                  lightHex: '#22583B',
                  bgClass: 'bg-status-supported-bg text-status-supported-text',
                  border: true,
                },
                {
                  name: 'Outdated',
                  token: '--status-outdated',
                  darkHex: '#E8C07A',
                  lightHex: '#764F0E',
                  bgClass: 'bg-status-outdated-bg text-status-outdated-text',
                  border: true,
                },
                {
                  name: 'Contradicted',
                  token: '--status-contradicted',
                  darkHex: '#E69AA4',
                  lightHex: '#832C37',
                  bgClass: 'bg-status-contradicted-bg text-status-contradicted-text',
                  border: true,
                },
                {
                  name: 'Unresolved',
                  token: '--status-unresolved',
                  darkHex: '#C2C0BD',
                  lightHex: '#4A4844',
                  bgClass: 'bg-status-unresolved-bg text-status-unresolved-text',
                  border: true,
                },
                {
                  name: 'Checking',
                  token: '--status-checking',
                  darkHex: '#B5AEBD',
                  lightHex: '#544660',
                  bgClass: 'bg-status-checking-bg text-status-checking-text',
                  border: true,
                },
              ].map((swatch) => (
                <div
                  key={swatch.token}
                  className="rounded-md border border-border-subtle p-3 space-y-2 bg-surface/40"
                >
                  <div
                    className={`h-10 w-full rounded-sm ${swatch.bgClass} ${
                      swatch.border ? 'border border-border-strong' : ''
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {swatch.name}
                    </p>
                    <p className="font-mono text-[10px] text-text-muted truncate">
                      {theme === 'dark' ? swatch.darkHex : swatch.lightHex}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* Typography Scale */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Typography Hierarchy (Refined Sans-Serif Scale)</h3>
            <div className="space-y-4">
              <div className="border-b border-border-subtle pb-3">
                <span className="font-mono text-[10px] text-text-muted">Product / Hero Heading (40–64px · Weight 400–500 · Tracking -0.035em)</span>
                <p className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-heading text-text-primary mt-1">
                  Clarity, even as facts change.
                </p>
              </div>

              <div className="border-b border-border-subtle pb-3">
                <span className="font-mono text-[10px] text-text-muted">Section Title (20–24px · Weight 500 · Tracking -0.025em)</span>
                <p className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary mt-1">
                  Temporal drift detection and factual alignment
                </p>
              </div>

              <div className="border-b border-border-subtle pb-3">
                <span className="font-mono text-[10px] text-text-muted">Intro & Body (16–18px · Line Height 1.6)</span>
                <p className="text-base sm:text-lg text-text-secondary max-w-3xl leading-[1.6] mt-1">
                  Check AI-generated answers against current sources. Verification properties isolate explicit factual qualifiers from model-inferred assumptions.
                </p>
              </div>

              <div className="border-b border-border-subtle pb-3">
                <span className="font-mono text-[10px] text-text-muted">Controls & Actions (14px · Weight 500)</span>
                <p className="text-sm font-medium text-text-primary mt-1">
                  Confirm and begin verification
                </p>
              </div>

              <div>
                <span className="font-mono text-[10px] text-text-muted">Code & Metadata (12–13px · Readable Contrast)</span>
                <p className="font-mono text-xs text-text-muted break-all mt-1">
                  SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069 · T_effective: 2026-11-08T00:00:00Z
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ====================================================================
          Section C: Buttons & Interaction States
          ==================================================================== */}
      <section id="buttons" className="space-y-6 text-left">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">2. Buttons & Interaction States</h2>
          <p className="text-xs text-text-secondary">
            Primary, secondary, quiet, and destructive variants across standard sizes and states.
          </p>
        </div>

        <Card variant="default" className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Variants (Medium Size)</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Action</Button>
              <Button variant="secondary">Secondary Action</Button>
              <Button variant="quiet">Quiet / Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button
                variant="secondary"
                iconOnly
                aria-label="Refresh preview"
                title="Refresh preview"
              >
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </div>
          </div>

          <Divider />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Sizes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small (sm)</Button>
              <Button size="md">Medium (md)</Button>
              <Button size="lg">Large (lg)</Button>
            </div>
          </div>

          <Divider />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">States (Disabled & Loading)</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled>
                Disabled Primary
              </Button>
              <Button variant="secondary" disabled>
                Disabled Secondary
              </Button>
              <Button variant="primary" loading>
                Processing...
              </Button>
              <Button variant="secondary" loading>
                Loading...
              </Button>
            </div>
          </div>

          <Divider />

          {/* Interactive button state testing demo */}
          <div className="rounded-md border border-border-subtle bg-surface-raised/40 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Interactive State Test
            </h3>
            <p className="text-xs text-text-secondary">
              Click the button below to toggle a simulated asynchronous loading state. Click count: <strong className="text-text-primary">{clickCount}</strong>.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                loading={buttonLoading}
                onClick={() => {
                  setButtonLoading(true);
                  setClickCount((c) => c + 1);
                  setTimeout(() => setButtonLoading(false), 900);
                }}
              >
                {buttonLoading ? 'Simulating Work...' : 'Trigger Loading State'}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setClickCount(0)}
              >
                Reset Count
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* ====================================================================
          Section D: Form Controls & Local Validation Form
          ==================================================================== */}
      <section id="forms" className="space-y-6 text-left">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">3. Form Controls & Local Validation</h2>
          <p className="text-xs text-text-secondary">
            Accessible inputs, textareas with character limits, selects, checkboxes, and switches.
          </p>
        </div>

        <Card variant="default">
          <form noValidate onSubmit={handleDemoFormSubmit} className="space-y-6 max-w-2xl">
            <CardHeader
              title="Interactive Local Validation Demo"
              description="Validates entirely in browser state. No verification requests or external network calls."
            />

            {formSubmitted && (
              <div
                role="status"
                className="rounded-md border border-status-supported-border bg-status-supported-bg p-3 text-xs text-status-supported-text font-medium flex items-center justify-between"
              >
                <span>Form validated cleanly in local memory!</span>
                <button
                  type="button"
                  onClick={() => setFormSubmitted(false)}
                  className="text-xs underline hover:opacity-80"
                >
                  Dismiss
                </button>
              </div>
            )}

            <Input
              label="Question or Topic Title"
              description="Enter a brief topic descriptor (minimum 5 characters)."
              placeholder="e.g. Stripe US Card Processing Fees"
              required
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
              error={formErrors.input}
            />

            <Textarea
              label="AI-Generated Answer to Verify"
              description="Paste text to test character counting and multi-line behavior."
              placeholder="Paste answer text here..."
              required
              showCount
              maxLength={500}
              value={demoTextarea}
              onChange={(e) => setDemoTextarea(e.target.value)}
              error={formErrors.textarea}
              rows={4}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Target Jurisdiction"
                description="Context qualifier for location-sensitive facts."
                value={demoSelect}
                onChange={(e) => setDemoSelect(e.target.value)}
                options={[
                  { value: 'us', label: 'United States (US / USD)' },
                  { value: 'uk', label: 'United Kingdom (UK / GBP)' },
                  { value: 'eu', label: 'European Union (EU / EUR)' },
                  { value: 'global', label: 'Global Default' },
                ]}
              />

              <div className="pt-2 sm:pt-6 space-y-4">
                <Checkbox
                  label="Strict Primary Authority"
                  description="Reject secondary aggregator citations."
                  checked={demoCheckbox}
                  onChange={(e) => setDemoCheckbox(e.target.checked)}
                />
              </div>
            </div>

            <Switch
              label="Enable Vector Candidate Shortlisting"
              description="Simulate the non-blocking A11 candidate ranking experiment."
              checked={demoSwitch}
              onChange={setDemoSwitch}
            />

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" variant="primary">
                Validate & Submit Demo
              </Button>
              <Button type="button" variant="quiet" onClick={handleResetForm}>
                Reset Form
              </Button>
            </div>
          </form>
        </Card>
      </section>

      {/* ====================================================================
          Section E: Verification States
          ==================================================================== */}
      <section id="status" className="space-y-6 text-left">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">4. Verification Status Badges</h2>
          <p className="text-xs text-text-secondary">
            Six distinct semantic states adhering to the deterministic scoring rubric (100 / 75 / 0 / null).
          </p>
        </div>

        <Card variant="default" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border-subtle p-4 space-y-2 bg-surface/40">
              <div className="flex items-center justify-between">
                <StatusBadge status="supported" />
                <span className="font-mono text-xs text-text-muted">Score: 100 / 75</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Directly supported by authoritative primary evidence within the matching scope and effective date range.
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle p-4 space-y-2 bg-surface/40">
              <div className="flex items-center justify-between">
                <StatusBadge status="outdated" />
                <span className="font-mono text-xs text-text-muted">Score: 0</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Was historically accurate under a past effective date, but has since been superseded by a documented transition.
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle p-4 space-y-2 bg-surface/40">
              <div className="flex items-center justify-between">
                <StatusBadge status="contradicted" />
                <span className="font-mono text-xs text-text-muted">Score: 0</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Directly refuted by authoritative evidence. Assertion was false even for its stated temporal context.
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle p-4 space-y-2 bg-surface/40">
              <div className="flex items-center justify-between">
                <StatusBadge status="unresolved" />
                <span className="font-mono text-xs text-text-muted">Score: null</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Essential context missing, conflicting sources without clear authority, or evidence unavailable. Not treated as false.
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle p-4 space-y-2 bg-surface/40">
              <div className="flex items-center justify-between">
                <StatusBadge status="checking" />
                <span className="font-mono text-xs text-text-muted">Progress State</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Active dynamic DAG node currently in progress (search, passage extraction, or sequential assessment).
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle p-4 space-y-2 bg-surface/40">
              <div className="flex items-center justify-between">
                <StatusBadge status="awaiting_clarification" />
                <span className="font-mono text-xs text-text-muted">Branch Paused</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Claim branch is paused awaiting user input on an essential qualifier. Holds zero worker leases while waiting.
              </p>
            </div>
          </div>

          <Notice title="Design Rule: Unresolved ≠ False">
            Unresolved claims use neutral stone styling and must never be styled in red/contradicted tones.
            Similarly, in-progress checking uses restrained lavender-gray and must not appear alarming.
          </Notice>
        </Card>
      </section>

      {/* ====================================================================
          Section F: Composed Product Samples
          ==================================================================== */}
      <section id="product-samples" className="space-y-6 text-left">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">5. Composed Product Samples</h2>
          <p className="text-xs text-text-secondary">
            Realistic compositions demonstrating how foundational primitives come together in C02/C04.
          </p>
        </div>

        <div className="space-y-6">
          {/* Sample 1: Input Composer */}
          <Card variant="default" className="space-y-4">
            <CardHeader
              title="Sample: Input Composer (Journey 1 Preview)"
              description="Headline prompt, text input area, and context badges."
            />
            <div className="space-y-3">
              <h4 className="text-base sm:text-lg font-medium tracking-tight text-text-primary">Is this still true?</h4>
              <div className="rounded-md border border-border-subtle bg-surface-raised/60 p-3 text-sm text-text-primary font-mono leading-relaxed">
                Stripe charges a 2.9% + 30¢ flat fee for standard credit card transactions in the US.
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <span>Context Qualifiers:</span>
                  <span className="rounded-md bg-surface border border-border-strong px-2 py-0.5 text-text-primary">
                    Jurisdiction: US
                  </span>
                  <span className="rounded-md bg-surface border border-border-strong px-2 py-0.5 text-text-primary">
                    Currency: USD
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => alert('Illustrative demo button: In C02 this triggers startPreparationAction.')}
                >
                  Verify Answer [Sample Demo]
                </Button>
              </div>
            </div>
          </Card>

          {/* Sample 2: Assessed Claim Card */}
          <Card variant="raised" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-strong">
              <div className="flex items-center gap-2">
                <StatusBadge status="outdated" />
                <span className="font-mono text-xs text-text-muted">Freshness Score: 0/100</span>
              </div>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setClaimExpanded(!claimExpanded)}
              >
                {claimExpanded ? 'Collapse Details' : 'Expand Details'}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary leading-relaxed">
                “Twitter Enterprise API access costs $42,000/month for firehose data stream access.”
              </p>
              <p className="text-xs text-text-secondary">
                Reason Code:{' '}
                <span className="font-mono text-status-outdated-text">
                  SUPERSEDED_BY_NEWER_POLICY
                </span>
              </p>
            </div>

            {claimExpanded && (
              <div className="rounded-md border border-border-subtle bg-surface p-4 space-y-4 mt-3">
                <div className="space-y-1">
                  <h5 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                    Change Timeline
                  </h5>
                  <p className="text-xs text-text-secondary">
                    Historical plan superseded by the X Developer Tier restructuring effective June 2023.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded border border-border-subtle bg-surface-raised/40 p-3 space-y-1">
                    <span className="font-semibold text-status-outdated-text">Then (Historical)</span>
                    <p className="text-text-primary">Enterprise plan at $42,000/mo</p>
                    <p className="text-text-muted text-[11px]">Effective: 2023-03-29</p>
                  </div>
                  <div className="rounded border border-border-subtle bg-surface-raised/40 p-3 space-y-1">
                    <span className="font-semibold text-status-supported-text">Now (Current)</span>
                    <p className="text-text-primary">Basic ($100/mo), Pro ($5,000/mo), Custom Enterprise</p>
                    <p className="text-text-muted text-[11px]">Effective: 2023-06-01</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Sample 3: Evidence Quotation */}
          <Card variant="default" className="space-y-4">
            <CardHeader
              title="Sample: Evidence Unit Citation"
              description="Verbatim excerpt verified against source document text."
            />
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-text-primary break-all">
                  Source: developer.twitter.com/en/docs/twitter-api/getting-started
                </span>
                <span className="font-mono text-text-muted text-[11px]">
                  Crawl Date: 2026-11-08 (Synthetic)
                </span>
              </div>

              <blockquote className="rounded-md border-l-2 border-accent bg-surface-raised/60 p-4 text-xs italic text-text-primary leading-relaxed">
                “Our developer platform offers three distinct tiers: Free for write-only use cases, Basic at $100 per month for hobbyists, and Pro at $5,000 per month for scaling startups...”
              </blockquote>

              <div className="flex items-center gap-4 text-[11px] text-text-secondary">
                <span>Provenance: <strong className="text-text-primary">Official Documentation</strong></span>
                <span>Redirect: <strong className="text-text-primary">HTTP 200 Final</strong></span>
                <span>Quotation Match: <strong className="text-status-supported-text">100% Verbatim</strong></span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ====================================================================
          Section G: Process & Feedback States
          ==================================================================== */}
      <section id="process" className="space-y-6 text-left">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">6. Process & Feedback States</h2>
          <p className="text-xs text-text-secondary">
            Loading placeholders, empty states, and interactive retry mechanisms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card variant="default" className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Loading Skeletons</h3>
            <p className="text-xs text-text-secondary">
              Subtle pulse animation that automatically freezes when reduced motion is preferred.
            </p>
            <div className="space-y-2.5 pt-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-32 rounded-full" />
              </div>
            </div>
          </Card>

          <Card variant="default" className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Interactive Retry Demo</h3>
            <p className="text-xs text-text-secondary">
              Inline error alert featuring a non-reloading local retry simulation.
            </p>

            {retryState === 'error' && (
              <div className="space-y-3 pt-2">
                <InlineError message="Search connection timed out after 8,000ms. Primary authority endpoint unreachable." />
                <Button variant="secondary" size="sm" onClick={handleSimulateRetry}>
                  Simulate Retry
                </Button>
              </div>
            )}

            {retryState === 'retrying' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <svg
                    className="h-4 w-4 animate-spin text-accent"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Reconnecting to simulated endpoint...</span>
                </div>
              </div>
            )}

            {retryState === 'resolved' && (
              <div className="space-y-3 pt-2">
                <Notice title="Connection Restored">
                  Successfully re-established connection and retrieved cached response.
                </Notice>
                <Button variant="quiet" size="sm" onClick={() => setRetryState('error')}>
                  Reset Error State
                </Button>
              </div>
            )}
          </Card>
        </div>

        <Card variant="default">
          <EmptyState
            title="No Verified Reports Yet"
            description="Paste an AI-generated response or draft a question to begin temporal fact-checking."
            action={
              <Link href="/">
                <Button variant="secondary" size="sm">
                  Return to Composer
                </Button>
              </Link>
            }
          />
        </Card>
      </section>

      {/* ====================================================================
          Section H: Usage Notes & Component Reference
          ==================================================================== */}
      <section id="usage" className="space-y-6 text-left">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">7. Component Inventory & Developer Notes</h2>
          <p className="text-xs text-text-secondary">
            Shared component contracts and import paths for downstream C02/C04 implementation.
          </p>
        </div>

        <Card variant="default" className="space-y-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-strong text-text-primary font-semibold">
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Import Path</th>
                  <th className="py-2.5 px-3">Key Props & Variants</th>
                  <th className="py-2.5 px-3">Accessibility Features</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono text-[11px] text-text-secondary">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">Button</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">primary, secondary, quiet, destructive; sm, md, lg; loading, iconOnly</td>
                  <td className="py-2.5 px-3 font-sans">aria-busy, disabled suppression, focus-visible outline</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">Input</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">label, description, error, required, disabled, readOnly</td>
                  <td className="py-2.5 px-3 font-sans">id/htmlFor link, aria-describedby, aria-invalid, aria-errormessage</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">Textarea</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">label, description, error, required, showCount, maxLength</td>
                  <td className="py-2.5 px-3 font-sans">Live character count, accessible description link</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">Select</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">label, description, error, options: SelectOption[]</td>
                  <td className="py-2.5 px-3 font-sans">Native keyboard accessibility (arrows/enter), styled chevron</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">Checkbox</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">label, description, error, checked, disabled</td>
                  <td className="py-2.5 px-3 font-sans">Full label click delegation, visible focus ring</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">Switch</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">label, description, checked, onChange, disabled</td>
                  <td className="py-2.5 px-3 font-sans">role=&quot;switch&quot;, aria-checked, Space/Enter keyboard handler</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">Card</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">default, raised, subtle; CardHeader slot</td>
                  <td className="py-2.5 px-3 font-sans">Semantic container, clear elevation hierarchy</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">StatusBadge</td>
                  <td className="py-2.5 px-3">@/components/ui</td>
                  <td className="py-2.5 px-3">supported, outdated, contradicted, unresolved, checking, awaiting_clarification</td>
                  <td className="py-2.5 px-3 font-sans">Icon + text pairing (never color alone), WCAG AA &gt; 6.6:1 contrast</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-text-primary">ThemeToggle</td>
                  <td className="py-2.5 px-3">@/components/theme</td>
                  <td className="py-2.5 px-3">showLabel?: boolean</td>
                  <td className="py-2.5 px-3 font-sans">Real button, dynamic aria-label describing next action</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Sample JSX Snippet
            </h4>
            <pre className="rounded-md bg-surface-raised p-4 font-mono text-xs text-text-secondary overflow-x-auto">
{`import { Button, StatusBadge, Card } from '@/components/ui';

export function ClaimResultCard({ claim, verdict }) {
  return (
    <Card variant="raised" className="space-y-3">
      <div className="flex items-center justify-between">
        <StatusBadge status={verdict} />
        <Button variant="quiet" size="sm">Inspect Evidence</Button>
      </div>
      <p className="text-sm text-text-primary">{claim.text}</p>
    </Card>
  );
}`}
            </pre>
          </div>
        </Card>
      </section>

      {/* ====================================================================
          Section I: C02 Product Experience: Input Composer & View States
          ==================================================================== */}
      <section id="c02-experience" className="space-y-6 text-left">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary">
              8. C02 Product Experience: Input Composer & View States
            </h2>
            <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-mono text-accent">
              Task C02
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Shared input composer and report presentation states: Loading, Empty, Partial, and Error.
          </p>
        </div>

        {/* Live Input Composer Instance */}
        <Card variant="default" className="space-y-4">
          <CardHeader
            title="Interactive Input Composer"
            description="Live component used on root page (/), featuring schema-based validation, character limits, and progressive context disclosure."
          />
          <InputComposer showSampleLink={true} />
        </Card>

        {/* View States Demo Grid */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">
            Report Presentation States
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Partial Verification State */}
            <Card variant="subtle" className="space-y-3">
              <h4 className="text-xs font-mono font-medium text-text-muted uppercase">
                State: Partial Verification
              </h4>
              <ReportPartialBanner completedCount={3} totalCount={5} />
            </Card>

            {/* Error / Unavailable State */}
            <Card variant="subtle" className="space-y-3">
              <h4 className="text-xs font-mono font-medium text-text-muted uppercase">
                State: Report Not Found / Error
              </h4>
              <ReportErrorState
                title="Sample Not Found State"
                message="Requested run 'sample_error_id' does not exist in persistent storage."
              />
            </Card>
          </div>

          {/* Empty Claims State */}
          <Card variant="subtle" className="space-y-3">
            <h4 className="text-xs font-mono font-medium text-text-muted uppercase">
              State: No Time-Sensitive Claims
            </h4>
            <ReportEmptyClaimsState answerText="A purely subjective paragraph containing no verifiable pricing, version, or regulatory claims." />
          </Card>

          {/* Loading Skeleton State */}
          <Card variant="subtle" className="space-y-3">
            <h4 className="text-xs font-mono font-medium text-text-muted uppercase">
              State: Loading Skeleton
            </h4>
            <ReportLoadingSkeleton />
          </Card>
        </div>
      </section>
    </div>
  );
}
