'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ScratchRevealHeadlineProps {
  className?: string;
  onRevealProgress?: (progress: number) => void;
  onRevealComplete?: () => void;
}

export function ScratchRevealHeadline({
  className = '',
  onRevealProgress,
  onRevealComplete,
}: ScratchRevealHeadlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  const [isFullyRevealed, setIsFullyRevealed] = useState<boolean>(false);
  const [hasStartedScratching, setHasStartedScratching] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Grid tracking for reveal percentage (24 columns x 6 rows = 144 cells)
  const gridRows = 6;
  const gridCols = 24;
  const scratchedCells = useRef<Set<number>>(new Set());
  const pathDataRef = useRef<string>('');
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Check prefers-reduced-motion on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsFullyRevealed(true);
      document.documentElement.style.setProperty('--hero-wordmark-opacity', '0.15');
      onRevealProgress?.(1);
      onRevealComplete?.();
    }
  }, [onRevealProgress, onRevealComplete]);

  // Keep SVG mask dimensions synchronized with responsive headline container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width, 100),
          height: Math.max(rect.height, 60),
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize, { passive: true });
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Complete the reveal smoothly
  const completeReveal = useCallback(() => {
    setIsFullyRevealed(true);
    document.documentElement.style.setProperty('--hero-wordmark-opacity', '0.15');
    onRevealProgress?.(1);
    onRevealComplete?.();
  }, [onRevealProgress, onRevealComplete]);

  // Mark grid cells touched by stroke segment
  const markCells = useCallback((x0: number, y0: number, x1: number, y1: number, radius: number) => {
    if (!dimensions.width || !dimensions.height) return;
    const cellW = dimensions.width / gridCols;
    const cellH = dimensions.height / gridRows;

    // Sample along line segment
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(Math.ceil(dist / 15), 1);

    for (let s = 0; s <= steps; s++) {
      const cx = x0 + (dx * s) / steps;
      const cy = y0 + (dy * s) / steps;

      const minCol = Math.max(0, Math.floor((cx - radius) / cellW));
      const maxCol = Math.min(gridCols - 1, Math.floor((cx + radius) / cellW));
      const minRow = Math.max(0, Math.floor((cy - radius) / cellH));
      const maxRow = Math.min(gridRows - 1, Math.floor((cy + radius) / cellH));

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          scratchedCells.current.add(r * gridCols + c);
        }
      }
    }

    const totalCells = gridRows * gridCols;
    const ratio = Math.min(scratchedCells.current.size / totalCells, 1);

    // Dynamically fade wordmark from 0.30 down to 0.15
    const wordmarkOpacity = 0.30 - ratio * 0.15;
    document.documentElement.style.setProperty('--hero-wordmark-opacity', wordmarkOpacity.toFixed(3));
    onRevealProgress?.(ratio);

    if (ratio >= 0.85) {
      completeReveal();
    }
  }, [dimensions, completeReveal, onRevealProgress]);

  // Handle pointer scratch movement
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isFullyRevealed || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!hasStartedScratching) {
      setHasStartedScratching(true);
    }

    const last = lastPointRef.current;
    if (last) {
      // Append stroke segment to SVG mask path directly without React re-render
      const newSegment = ` M ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      pathDataRef.current += newSegment;
      if (pathRef.current) {
        pathRef.current.setAttribute('d', pathDataRef.current);
      }
      // Brush diameter ~90px (radius ~45px)
      markCells(last.x, last.y, x, y, 45);
    } else {
      const startDot = ` M ${x.toFixed(1)} ${y.toFixed(1)} m -0.1,0 a 0.1,0.1 0 1,0 0.2,0 a 0.1,0.1 0 1,0 -0.2,0`;
      pathDataRef.current += startDot;
      if (pathRef.current) {
        pathRef.current.setAttribute('d', pathDataRef.current);
      }
    }

    lastPointRef.current = { x, y };
  };

  const handlePointerLeave = () => {
    lastPointRef.current = null;
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      completeReveal();
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={() => {
        // Tap to reveal on touch devices or quick click
        if (!isFullyRevealed) {
          completeReveal();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={isFullyRevealed ? -1 : 0}
      role="region"
      aria-label="Interactive headline reveal. Move cursor or press Enter to reveal."
      className={`relative select-none outline-none group cursor-default ${className}`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* 1. SVG ACCUMULATING WHITE MASK DEFINITION */}
      {!isFullyRevealed && dimensions.width > 0 && (
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 pointer-events-none -z-20 overflow-hidden"
          style={{ width: dimensions.width, height: dimensions.height }}
          aria-hidden="true"
        >
          <defs>
            <filter id="scratch-feather" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <mask
              id="headline-scratch-mask"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={dimensions.width}
              height={dimensions.height}
            >
              {/* Black background conceals text */}
              <rect width="100%" height="100%" fill="black" />
              {/* White accumulating path reveals text */}
              <path
                ref={pathRef}
                d=""
                fill="none"
                stroke="white"
                strokeWidth="90"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#scratch-feather)"
              />
            </mask>
          </defs>
        </svg>
      )}

      {/* 2. BASE GHOSTED HEADLINE (SUBTLY VISIBLE UNDERNEATH, NO AWKWARD BLANK VOID) */}
      <div className="text-center select-none" aria-hidden="true">
        <span className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-[5.5rem] font-normal tracking-tight text-text-muted/25 dark:text-[#9A9AA0]/20 text-center leading-[1.06] block">
          Every claim has a story.
        </span>
      </div>

      {/* 3. FOREGROUND ILLUMINATED HEADLINE (REVEALED BY SCRATCH MASK) */}
      <div
        className="absolute inset-0 transition-opacity duration-300 text-center pointer-events-none"
        style={{
          mask: isFullyRevealed ? 'none' : 'url(#headline-scratch-mask)',
          WebkitMask: isFullyRevealed ? 'none' : 'url(#headline-scratch-mask)',
        }}
      >
        <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-[5.5rem] font-normal tracking-tight text-text-primary text-center leading-[1.06] drop-shadow-sm">
          Every claim has a story.
        </h1>
      </div>
    </div>
  );
}
