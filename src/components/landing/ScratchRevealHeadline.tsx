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
    const steps = Math.max(Math.ceil(dist / 12), 1);

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
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.5) {
        const nx = -dy / dist;
        const ny = dx / dist;

        // Dynamic non-uniformity: subtle pseudo-random bristle jitter for organic analog tooth
        const jitterA = Math.sin(last.x * 0.17 + last.y * 0.11) * 2.5;
        const jitterB = Math.cos(x * 0.13 + y * 0.19) * 2.5;

        // Primary connecting stroke
        const mainSegment = ` M ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
        
        // Secondary offset bristle for non-uniform tooth
        const bristleSegment = ` M ${(last.x + nx * jitterA).toFixed(1)} ${(last.y + ny * jitterA).toFixed(1)} L ${(x + nx * jitterB).toFixed(1)} ${(y + ny * jitterB).toFixed(1)}`;

        pathDataRef.current += mainSegment + bristleSegment;

        // Stippled micro-scratch flecks along stroke edge for realistic abrasion
        if (dist > 5) {
          const midX = (last.x + x) * 0.5 + nx * jitterA * 1.2;
          const midY = (last.y + y) * 0.5 + ny * jitterA * 1.2;
          pathDataRef.current += ` M ${midX.toFixed(1)} ${midY.toFixed(1)} m -1.5,0 a 1.5,1.5 0 1,0 3,0 a 1.5,1.5 0 1,0 -3,0`;
        }

        if (pathRef.current) {
          pathRef.current.setAttribute('d', pathDataRef.current);
        }

        markCells(last.x, last.y, x, y, 16);
      }
    } else {
      const startDot = ` M ${x.toFixed(1)} ${y.toFixed(1)} m -4,0 a 4,4 0 1,0 8,0 a 4,4 0 1,0 -8,0`;
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
            <filter id="scratch-feather" x="-30%" y="-30%" width="160%" height="160%">
              {/* Organic fractal noise adds tooth and non-uniform abrasion to stroke edges */}
              <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur in="displaced" stdDeviation="1.5" />
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
              {/* White accumulating path reveals text with non-uniform brush */}
              <path
                ref={pathRef}
                d=""
                fill="none"
                stroke="white"
                strokeWidth="26"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#scratch-feather)"
              />
            </mask>
          </defs>
        </svg>
      )}

      {/* 2. THE HEADLINE H1 WITH MASK APPLIED (COMPLETELY INVISIBLE AT FIRST UNTIL SCRATCHED) */}
      <div
        className="transition-opacity duration-500 text-left"
        style={{
          mask: isFullyRevealed ? 'none' : 'url(#headline-scratch-mask)',
          WebkitMask: isFullyRevealed ? 'none' : 'url(#headline-scratch-mask)',
        }}
      >
        <h1 className="hero-headline font-serif text-[clamp(14px,1.3vw,17px)] font-normal tracking-[0.01em] text-[#A8A09B] text-left leading-[1.2] drop-shadow-sm origin-left scale-x-[0.94] whitespace-nowrap">
          Every claim has a story.
        </h1>
      </div>
    </div>
  );
}
