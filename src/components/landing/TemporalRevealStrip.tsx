'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface DemonstrationPair {
  id: 'pluto' | 'uk';
  categoryLabel: string;
  prefix: string;
  wrongPart: string;
  correctedPart: string;
  historicalContext: string;
  classificationContext: string;
  effectiveDate: string;
}

export const DEMO_PAIRS: DemonstrationPair[] = [
  {
    id: 'pluto',
    categoryLabel: 'TEMPORAL CLASSIFICATION',
    prefix: 'Pluto is ',
    wrongPart: 'the ninth planet in our solar system.',
    correctedPart: 'classified as a dwarf planet.',
    historicalContext: 'Before August 2006',
    classificationContext: 'IAU Classification, 2006',
    effectiveDate: 'August 2006',
  },
  {
    id: 'uk',
    categoryLabel: 'TEMPORAL CHANGE',
    prefix: 'The United Kingdom ',
    wrongPart: 'is a member of the European Union.',
    correctedPart: 'left the European Union on 31 January 2020.',
    historicalContext: 'Before 31 January 2020',
    classificationContext: 'EU Withdrawal Agreement',
    effectiveDate: '31 January 2020',
  },
];

interface TemporalRevealStripProps {
  className?: string;
  initialPairId?: 'pluto' | 'uk';
}

export function TemporalRevealStrip({
  className = '',
  initialPairId,
}: TemporalRevealStripProps) {
  // Randomly select between the two demonstration examples on mount if initialPairId not explicitly set
  const [activePairId, setActivePairId] = useState<'pluto' | 'uk'>(initialPairId || 'pluto');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [hasStartedDragging, setHasStartedDragging] = useState<boolean>(false);
  const [undercutPercent, setUndercutPercent] = useState<number>(0);

  useEffect(() => {
    if (!initialPairId) {
      const picked = Math.random() < 0.5 ? 'pluto' : 'uk';
      setActivePairId(picked);
    }
  }, [initialPairId]);

  const activePair = DEMO_PAIRS.find((p) => p.id === activePairId) || DEMO_PAIRS[0];

  // DOM Refs for direct 60fps manipulation
  const wrongTrackRef = useRef<HTMLSpanElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const strikeLineRef = useRef<HTMLSpanElement>(null);
  const correctedSpanRef = useRef<HTMLSpanElement>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const isCompletedRef = useRef<boolean>(false);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
    if (isCompleted) {
      setUndercutPercent(100);
      if (strikeLineRef.current) {
        strikeLineRef.current.style.width = '100%';
      }
      if (correctedSpanRef.current) {
        correctedSpanRef.current.style.clipPath = 'none';
        correctedSpanRef.current.style.opacity = '1';
      }
    }
  }, [isCompleted]);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsCompleted(true);
      isCompletedRef.current = true;
      setUndercutPercent(100);
    }
  }, []);

  // Complete inspection routine
  const completeInspection = useCallback(() => {
    if (isCompletedRef.current) return;
    setIsCompleted(true);
    isCompletedRef.current = true;
    setUndercutPercent(100);

    if (strikeLineRef.current) {
      strikeLineRef.current.style.width = '100%';
    }
    if (correctedSpanRef.current) {
      correctedSpanRef.current.style.clipPath = 'none';
      correctedSpanRef.current.style.opacity = '1';
    }
    if (wrongTrackRef.current && lensRef.current) {
      const rect = wrongTrackRef.current.getBoundingClientRect();
      lensRef.current.style.transform = `translate3d(${rect.width}px, -50%, 0px)`;
    }
  }, []);

  // Pointer drag calculation: only covers the specific wrong part
  const handlePointerMovement = useCallback((clientX: number) => {
    if (isCompletedRef.current || !wrongTrackRef.current) return;

    const rect = wrongTrackRef.current.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rawX, rect.width));
    const ratio = rect.width > 0 ? clampedX / rect.width : 0;
    const percent = Math.min(100, Math.round(ratio * 100));

    // Update lens position directly over the wrong part
    if (lensRef.current) {
      lensRef.current.style.transform = `translate3d(${clampedX}px, -50%, 0px)`;
    }

    // Update real-time undercut strikethrough line on the wrong part
    if (strikeLineRef.current) {
      strikeLineRef.current.style.width = `${percent}%`;
    }

    // Reveal the corrected words live as the glass drags (live clip-path following progress)
    if (correctedSpanRef.current) {
      const revealCut = Math.max(0, 100 - percent * 1.25);
      correctedSpanRef.current.style.clipPath = `inset(0 ${revealCut}% 0 0)`;
      correctedSpanRef.current.style.opacity = percent > 5 ? '1' : '0';
    }

    setUndercutPercent(percent);

    if (ratio >= 0.82) {
      completeInspection();
    }
  }, [completeInspection]);

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    isPointerDownRef.current = true;
    setHasStartedDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerMovement(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!isPointerDownRef.current && !e.buttons) return;
    handlePointerMovement(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    isPointerDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      completeInspection();
    }
  };

  return (
    <div
      className={`w-full text-xs select-none ${className}`}
      role="region"
      aria-label="Temporal verification demonstration: inspect outdated assertions against verified ground truth"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 py-1">
        
        {/* 1. DISCREET CLASSIFICATION METADATA */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--af-sage)]" aria-hidden="true" />
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--af-silver)]/80">
            {activePair.categoryLabel}
          </span>
        </div>

        {/* 2. THE CENTRAL INTERACTIVE SENTENCE TRACK: LIVE UNDERCUT ON WRONG PART ONLY */}
        <div className="relative flex-1 flex items-center justify-start lg:justify-center overflow-visible px-2 sm:px-4 py-1">
          <div className="flex flex-wrap items-center gap-1.5 font-serif text-[clamp(13px,1.25vw,16px)]">
            
            {/* TRUE PREFIX (UNTOUCHED) */}
            <span className="text-[var(--af-silver)]">
              {activePair.prefix}
            </span>

            {/* THE SPECIFIC WRONG PART (ONLY THIS PORTION GETS UNDERCUT LIVE) */}
            <span
              ref={wrongTrackRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative inline-block cursor-grab active:cursor-grabbing py-0.5 px-0.5 group/track"
              style={{ touchAction: 'pan-y' }}
              title="Drag the verification lens across the outdated words to undercut them and reveal the ground truth live"
            >
              {/* Outdated words */}
              <span
                className={`transition-colors duration-200 ${
                  isCompleted
                    ? 'text-[var(--af-silver)]/40'
                    : undercutPercent > 25
                    ? 'text-[var(--af-silver)]/65'
                    : 'text-[var(--af-silver)]'
                }`}
              >
                {activePair.wrongPart}
              </span>

              {/* REAL-TIME UNDERCUT STRIKETHROUGH LINE */}
              <span
                ref={strikeLineRef}
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-[#9E8E84] transition-[width] duration-75 pointer-events-none"
                style={{ width: `${undercutPercent}%` }}
                aria-hidden="true"
              />

              {/* THE CUSTOM DRAGGABLE VERIFICATION LENS (WITH ENLARGED LOGO) */}
              {!isCompleted && (
                <div
                  ref={lensRef}
                  className="absolute top-1/2 -translate-y-1/2 -left-6 pointer-events-none z-30 transition-transform duration-75 ease-out"
                  style={{ willChange: 'transform' }}
                >
                  <div className="relative group/lens">
                    {/* Optical Circular Body: 48px - 52px */}
                    <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full border border-[rgba(232,225,218,0.5)] bg-white/[0.04] backdrop-blur-[2px] shadow-[0_4px_18px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.25)] flex items-center justify-center">
                      
                      {/* Restrained Optical Specular Arc (Top-Left Highlight) */}
                      <svg
                        viewBox="0 0 52 52"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        fill="none"
                      >
                        <path
                          d="M 10 20 A 20 20 0 0 1 28 8"
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>

                      {/* ENLARGED PROMINENT ARCHITECTURAL TRIANGULAR 'A' LOGO */}
                      <svg
                        width="24"
                        height="26"
                        viewBox="0 0 60 64"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="opacity-95 text-[var(--af-ivory)] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                        aria-hidden="true"
                      >
                        {/* Outer Triangle Body */}
                        <path
                          d="M30 4.2 L56.5 55.8 C57.1 57.0 56.2 58.5 54.8 58.5 L5.2 58.5 C3.8 58.5 2.9 57.0 3.5 55.8 L30 4.2 Z"
                          fill="#18191D"
                          stroke="rgba(232,225,218,0.75)"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                        />
                        {/* Inner Precision Capital A */}
                        <path
                          d="M30 20.5 L22.2 46.5 H26.2 L28.1 39.8 H31.9 L33.8 46.5 H37.8 L30 20.5 Z M30 27.8 L31.2 36.2 H28.8 L30 27.8 Z"
                          fill="#FFFFFF"
                          fillRule="evenodd"
                        />
                      </svg>
                    </div>

                    {/* Precision Loupe Grip Pin */}
                    <div className="absolute -bottom-1 -right-0.5 w-1.5 h-3.5 rounded-full bg-gradient-to-b from-[#AAA1A6] to-[#2B292C] border border-white/20 shadow-xs rotate-[-35deg]" />

                    {/* Gentle interaction hint when not yet dragged */}
                    {!hasStartedDragging && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-60 text-[8px] font-mono uppercase tracking-[0.18em] text-[var(--af-silver)]">
                        Drag to verify →
                      </div>
                    )}
                  </div>
                </div>
              )}
            </span>

            {/* THE CORRECTED WORDS (APPEAR LIVE AS GLASS DRAGS — AFTER UNDERCUT, ZERO OVERLAP) */}
            <span
              ref={correctedSpanRef}
              className="inline-flex items-center gap-1.5 overflow-hidden transition-opacity duration-150"
              style={{
                opacity: isCompleted ? 1 : undercutPercent > 5 ? 1 : 0,
                clipPath: isCompleted ? 'none' : `inset(0 ${Math.max(0, 100 - undercutPercent * 1.25)}% 0 0)`,
              }}
            >
              <span className="text-[var(--af-silver)]/50 text-sm" aria-hidden="true">
                →
              </span>
              <span className="text-[var(--af-ivory)] font-normal drop-shadow-sm whitespace-nowrap">
                {activePair.correctedPart}
              </span>
            </span>

          </div>
        </div>

        {/* 3. METADATA & STATUS BADGE (RIGHT SIDE) */}
        <div className="flex items-center justify-end gap-2.5 shrink-0 min-w-[140px] sm:min-w-[160px]">
          {isCompleted ? (
            /* COMPLETION STATE: RESTRICTED SAGE BADGE & EFFECTIVE DATE */
            <div className="flex items-center gap-2 animate-in fade-in duration-300">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-[var(--af-sage)]/15 border border-[var(--af-sage)]/35 text-[var(--af-sage)] font-mono text-[9px] tracking-widest uppercase font-medium">
                <span className="w-1 h-1 rounded-full bg-[var(--af-sage)] animate-pulse" />
                CORRECTED
              </span>
              <span className="text-[10px] font-mono text-[var(--af-silver)]/80 tracking-wide">
                {activePair.effectiveDate}
              </span>
            </div>
          ) : (
            /* INITIAL STATE: HISTORICAL CONTEXT ANNOTATION */
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--af-silver)]/60">
              <span className="text-[9px] tracking-wider uppercase">HISTORICAL:</span>
              <span className="text-[var(--af-silver)]/80">{activePair.historicalContext}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
