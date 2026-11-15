import React from 'react';

interface EmblemProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Emblem({ className = '', size = 'md' }: EmblemProps) {
  const dimensions = {
    sm: { width: 42, height: 44, viewBox: '0 0 60 64' },
    md: { width: 56, height: 60, viewBox: '0 0 60 64' },
    lg: { width: 72, height: 76, viewBox: '0 0 60 64' },
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center transition-transform duration-300 hover:scale-105 select-none ${className}`}
      aria-label="Afterfact Emblem"
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={dimensions.viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
      >
        <defs>
          {/* Subtle metallic obsidian gradient */}
          <linearGradient id="emblemBg" x1="30" y1="2" x2="30" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#25262B" />
            <stop offset="50%" stopColor="#18191D" />
            <stop offset="100%" stopColor="#111215" />
          </linearGradient>

          {/* Border rim light gradient */}
          <linearGradient id="emblemBorder" x1="30" y1="2" x2="30" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#555861" />
            <stop offset="60%" stopColor="#2E3036" />
            <stop offset="100%" stopColor="#1C1D21" />
          </linearGradient>

          {/* Inner hairline glow */}
          <linearGradient id="innerGlow" x1="30" y1="8" x2="30" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.22)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
          </linearGradient>
        </defs>

        {/* Outer Triangle Body with subtle chamfered radius */}
        <path
          d="M30 4.2
             L56.5 55.8 
             C57.1 57.0 56.2 58.5 54.8 58.5 
             L5.2 58.5 
             C3.8 58.5 2.9 57.0 3.5 55.8 
             L30 4.2 Z"
          fill="url(#emblemBg)"
          stroke="url(#emblemBorder)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Inner architectural hairline */}
        <path
          d="M30 9.5 
             L53.2 54.5 
             L6.8 54.5 Z"
          fill="none"
          stroke="url(#innerGlow)"
          strokeWidth="0.75"
          strokeOpacity="0.6"
        />

        {/* Precision Architectural Capital "A" */}
        {/* Optically centered within the triangular centroid */}
        <g id="letter-A">
          {/* Main A Glyph: clean, sharp apex, precision crossbar */}
          <path
            d="M30 20.8
               L22.4 46.5
               H26.2
               L28.1 39.8
               H31.9
               L33.8 46.5
               H37.6
               L30 20.8 Z
               M30 28.2
               L31.1 36.3
               H28.9
               L30 28.2 Z"
            fill="#FFFFFF"
            fillRule="evenodd"
          />
        </g>
      </svg>
    </div>
  );
}
