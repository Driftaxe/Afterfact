'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface DemonstrationPair {
  id: 'pluto' | 'uk';
  categoryNumber: string;
  categoryLabel: string;
  originalAssertion: string;
  historicalContext: string;
  correctedAssertion: string;
  classificationContext: string;
  effectiveDate: string;
}

export const DEMO_PAIRS: DemonstrationPair[] = [
  {
    id: 'pluto',
    categoryNumber: '01',
    categoryLabel: 'CLASSIFICATION',
    originalAssertion: 'Pluto is the ninth planet in our solar system.',
    historicalContext: 'Before August 2006',
    correctedAssertion: 'Pluto is classified as a dwarf planet.',
    classificationContext: 'IAU Classification, 2006',
    effectiveDate: 'August 2006',
  },
  {
    id: 'uk',
    categoryNumber: '02',
    categoryLabel: 'TEMPORAL CHANGE',
    originalAssertion: 'The United Kingdom is a member of the European Union.',
    historicalContext: 'Before 31 January 2020',
    correctedAssertion: 'The United Kingdom left the European Union on 31 January 2020.',
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
  initialPairId = 'pluto',
}: TemporalRevealStripProps) {
  const [activePairId, setActivePairId] = useState<'pluto' | 'uk'>(initialPairId);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [hasStartedDragging, setHasStartedDragging] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const activePair = DEMO_PAIRS.find((p) => p.id === activePairId) || DEMO_PAIRS[0];

  // DOM Refs for zero-rerender pointer tracking
  const trackRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const revealTrailRef = useRef<SVGPathElement>(null);
  const dimTrailRef = useRef<SVGPathElement>(null);

  // Interaction tracking refs
  const isPointerDownRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pathDataRef = useRef<string>('');
  const maxReachedXRef = useRef<number>(0);
  const isCompletedRef = useRef<boolean>(false);

  // Sync completion ref with state
  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  // Keep track dimensions measured
  useEffect(() => {
    const updateDimensions = () => {
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width, 180),
          height: Math.max(rect.height, 40),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions, { passive: true });
    return () => window.removeEventListener('resize', updateDimensions);
  }, [activePairId]);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsCompleted(true);
      isCompletedRef.current = true;
    }
  }, []);

  // Complete inspection routine
  const completeInspection = useCallback(() => {
    if (isCompletedRef.current) return;
    setIsCompleted(true);
    isCompletedRef.current = true;

    // Fill entire track with reveal path if dimensions are known
    if (dimensions.width > 0 && dimensions.height > 0) {
      const fullSegment = `M 0 ${dimensions.height / 2} L ${dimensions.width + 20} ${dimensions.height / 2}`;
      pathDataRef.current += fullSegment;
      if (revealTrailRef.current) {
        revealTrailRef.current.setAttribute('d', pathDataRef.current);
      }
      if (dimTrailRef.current) {
        dimTrailRef.current.setAttribute('d', pathDataRef.current);
      }
      if (lensRef.current) {
        lensRef.current.style.transform = `translate3d(${dimensions.width - 24}px, 0px, 0px)`;
      }
    }
  }, [dimensions]);

  // Switch demonstration pair
  const switchPair = (pairId: 'pluto' | 'uk') => {
    if (pairId === activePairId) return;
    setActivePairId(pairId);
    setIsCompleted(false);
    isCompletedRef.current = false;
    setHasStartedDragging(false);
    pathDataRef.current = '';
    maxReachedXRef.current = 0;
    lastPointRef.current = null;

    if (revealTrailRef.current) {
      revealTrailRef.current.setAttribute('d', '');
    }
    if (dimTrailRef.current) {
      dimTrailRef.current.setAttribute('d', '');
    }
    if (lensRef.current) {
      lensRef.current.style.transform = `translate3d(0px, 0px, 0px)`;
    }
  };

  // Direct DOM pointer movement handler (bypasses React state for 60fps smoothness)
  const applyPointerMove = useCallback((clientX: number, _clientY?: number) => {
    if (isCompletedRef.current || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rawX, rect.width));
    const clampedY = rect.height / 2; // Locked to optical midline for precision guidance

    // Move lens element directly
    if (lensRef.current) {
      lensRef.current.style.transform = `translate3d(${clampedX}px, 0px, 0px)`;
    }

    const last = lastPointRef.current;
    if (last) {
      // Append stroke segment to accumulating reveal trail
      const segment = ` M ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${clampedX.toFixed(1)} ${clampedY.toFixed(1)}`;
      pathDataRef.current += segment;

      if (revealTrailRef.current) {
        revealTrailRef.current.setAttribute('d', pathDataRef.current);
      }
      if (dimTrailRef.current) {
        dimTrailRef.current.setAttribute('d', pathDataRef.current);
      }
    } else {
      // Initial contact dot
      const dot = ` M ${clampedX.toFixed(1)} ${clampedY.toFixed(1)} m -16,0 a 16,16 0 1,0 32,0 a 16,16 0 1,0 -32,0`;
      pathDataRef.current += dot;
      if (revealTrailRef.current) {
        revealTrailRef.current.setAttribute('d', pathDataRef.current);
      }
      if (dimTrailRef.current) {
        dimTrailRef.current.setAttribute('d', pathDataRef.current);
      }
    }

    lastPointRef.current = { x: clampedX, y: clampedY };
    maxReachedXRef.current = Math.max(maxReachedXRef.current, clampedX);

    // Completion threshold: ~85% of sentence span uncovered
    const revealRatio = rect.width > 0 ? maxReachedXRef.current / rect.width : 0;
    if (revealRatio >= 0.82) {
      completeInspection();
    }
  }, [completeInspection]);

  // Pointer event listeners
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = true;
    setHasStartedDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointerMove(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current && !e.buttons) return;
    applyPointerMove(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = false;
    lastPointRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already lost
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      completeInspection();
    } else if (e.key === '1') {
      switchPair('pluto');
    } else if (e.key === '2') {
      switchPair('uk');
    } else if (e.key === 'ArrowRight' && trackRef.current) {
      const step = 45;
      const nextX = Math.min(maxReachedXRef.current + step, dimensions.width);
      const rect = trackRef.current.getBoundingClientRect();
      applyPointerMove(rect.left + nextX, rect.top + dimensions.height / 2);
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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 py-1">
        
        {/* 1. DISCREET PAIR SWITCHER (01 / CLASSIFICATION  |  02 / TEMPORAL CHANGE) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[var(--af-silver)]/50 mr-1 hidden sm:inline">
            DEMO:
          </span>

          {DEMO_PAIRS.map((pair) => {
            const isActive = pair.id === activePairId;
            return (
              <button
                key={pair.id}
                type="button"
                onClick={() => switchPair(pair.id)}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-mono text-[10px] sm:text-[11px] tracking-[0.12em] uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--af-sage)] ${
                  isActive
                    ? 'bg-[var(--af-graphite)]/70 text-[var(--af-ivory)] border border-[rgba(232,225,218,0.22)] shadow-xs font-medium'
                    : 'text-[var(--af-silver)]/70 hover:text-[var(--af-ivory)] border border-transparent hover:border-[rgba(232,225,218,0.1)]'
                }`}
                aria-pressed={isActive}
              >
                <span className={`text-[9px] ${isActive ? 'text-[var(--af-sage)]' : 'text-[var(--af-silver)]/50'}`}>
                  {pair.categoryNumber}
                </span>
                <span>/</span>
                <span>{pair.categoryLabel}</span>
              </button>
            );
          })}
        </div>

        {/* 2. THE CENTRAL INTERACTIVE SENTENCE INSPECTION TRACK */}
        <div className="relative flex-1 flex items-center justify-start md:justify-center overflow-visible px-2 sm:px-4 py-1.5">
          <div
            ref={trackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative inline-block cursor-grab active:cursor-grabbing touch-pan-y py-1 group/track max-w-full"
            style={{ touchAction: 'pan-y' }}
            title="Drag the verification lens across the sentence to reveal the corrected assertion"
          >
            {/* SVG MASKS ACCUMULATION DEFINITION */}
            {dimensions.width > 0 && (
              <svg
                width={dimensions.width}
                height={dimensions.height}
                className="absolute inset-0 pointer-events-none -z-20 overflow-hidden"
                style={{ width: dimensions.width, height: dimensions.height }}
                aria-hidden="true"
              >
                <defs>
                  <filter id={`lens-feather-${activePair.id}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" />
                  </filter>

                  {/* Mask A: Conceals corrected text until lens paths reveal it */}
                  <mask
                    id={`lens-reveal-mask-${activePair.id}`}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width={dimensions.width}
                    height={dimensions.height}
                  >
                    <rect width="100%" height="100%" fill={isCompleted ? 'white' : 'black'} />
                    {!isCompleted && (
                      <path
                        ref={revealTrailRef}
                        d=""
                        fill="none"
                        stroke="white"
                        strokeWidth="54"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={`url(#lens-feather-${activePair.id})`}
                      />
                    )}
                  </mask>

                  {/* Mask B: Conceals/dims original text under lens as correction emerges */}
                  <mask
                    id={`lens-dim-mask-${activePair.id}`}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width={dimensions.width}
                    height={dimensions.height}
                  >
                    <rect width="100%" height="100%" fill="white" />
                    {!isCompleted && (
                      <path
                        ref={dimTrailRef}
                        d=""
                        fill="none"
                        stroke="rgba(0,0,0,0.85)"
                        strokeWidth="54"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={`url(#lens-feather-${activePair.id})`}
                      />
                    )}
                  </mask>
                </defs>
              </svg>
            )}

            {/* LAYER 1: ORIGINAL ASSERTION (MUTED SILVER, CROSS-FADED AS REVEALED) */}
            <div
              className="transition-opacity duration-300"
              style={{
                mask: isCompleted ? 'none' : `url(#lens-dim-mask-${activePair.id})`,
                WebkitMask: isCompleted ? 'none' : `url(#lens-dim-mask-${activePair.id})`,
              }}
            >
              <span
                className={`font-serif text-[clamp(13px,1.25vw,16px)] tracking-[0.01em] transition-all duration-300 block ${
                  isCompleted
                    ? 'line-through text-[var(--af-silver)]/35 opacity-40 scale-x-[0.96] origin-left'
                    : 'text-[var(--af-silver)] opacity-85 scale-x-[0.96] origin-left'
                }`}
              >
                {activePair.originalAssertion}
              </span>
            </div>

            {/* LAYER 2: CORRECTED ASSERTION (WARM IVORY, UNVEILED UNDERNEATH) */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 flex items-center"
              style={{
                mask: isCompleted ? 'none' : `url(#lens-reveal-mask-${activePair.id})`,
                WebkitMask: isCompleted ? 'none' : `url(#lens-reveal-mask-${activePair.id})`,
              }}
              aria-hidden={!isCompleted}
            >
              <span className="font-serif text-[clamp(13px,1.25vw,16px)] tracking-[0.01em] text-[var(--af-ivory)] font-normal drop-shadow-sm scale-x-[0.96] origin-left whitespace-nowrap">
                {activePair.correctedAssertion}
              </span>
            </div>

            {/* THE CUSTOM DRAGGABLE VERIFICATION LENS */}
            {!isCompleted && (
              <div
                ref={lensRef}
                className="absolute top-1/2 -translate-y-1/2 -left-5 pointer-events-none z-30 transition-transform duration-75 ease-out"
                style={{ willChange: 'transform' }}
              >
                <div className="relative group/lens">
                  {/* Optical Circular Body */}
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-[rgba(232,225,218,0.42)] bg-white/[0.04] backdrop-blur-[2px] shadow-[0_4px_16px_rgba(0,0,0,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.22)] flex items-center justify-center">
                    
                    {/* Restrained Optical Specular Arc (Top-Left Highlight) */}
                    <svg
                      viewBox="0 0 44 44"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      fill="none"
                    >
                      <path
                        d="M 9 17 A 16 16 0 0 1 23 7"
                        stroke="rgba(255,255,255,0.32)"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Miniature Architectural Triangular 'A' Emblem in Centre */}
                    <svg
                      width="15"
                      height="16"
                      viewBox="0 0 60 64"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="opacity-80 text-[var(--af-ivory)] filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                    >
                      {/* Outer Triangle Body */}
                      <path
                        d="M30 4.2 L56.5 55.8 C57.1 57.0 56.2 58.5 54.8 58.5 L5.2 58.5 C3.8 58.5 2.9 57.0 3.5 55.8 L30 4.2 Z"
                        fill="#1C1D21"
                        stroke="rgba(232,225,218,0.6)"
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

                  {/* Minimal Precision Loupe Grip Pin (At 45-degree bottom angle) */}
                  <div className="absolute -bottom-1 -right-0.5 w-1.5 h-3 rounded-full bg-gradient-to-b from-[#AAA1A6] to-[#38363A] border border-white/20 shadow-xs rotate-[-35deg]" />

                  {/* Gentle interaction hint when not yet dragged */}
                  {!hasStartedDragging && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-60 text-[8px] font-mono uppercase tracking-[0.18em] text-[var(--af-silver)]">
                      Drag to verify →
                    </div>
                  )}
                </div>
              </div>
            )}
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
