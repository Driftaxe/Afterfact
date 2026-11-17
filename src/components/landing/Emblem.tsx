'use client';

import React from 'react';

interface EmblemProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Emblem({ className = '', size = 'md' }: EmblemProps) {
  const dimensions = {
    sm: { width: 44, height: 46, viewBox: '0 0 60 64' },
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
        className="filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.28)]"
      >
        <defs>
          {/* Obsidian graphite gradient */}
          <linearGradient id="emblemBg" x1="30" y1="2" x2="30" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#222327" />
            <stop offset="50%" stopColor="#16171A" />
            <stop offset="100%" stopColor="#101114" />
          </linearGradient>

          {/* Border rim metallic gradient */}
          <linearGradient id="emblemBorder" x1="30" y1="2" x2="30" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3C3E44" />
            <stop offset="60%" stopColor="#24252A" />
            <stop offset="100%" stopColor="#18191D" />
          </linearGradient>

          {/* Inner hairline glow */}
          <linearGradient id="innerGlow" x1="30" y1="8" x2="30" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.14)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.01)" />
          </linearGradient>
        </defs>

        {/* Outer Triangle Body: Exactly centered around X = 30.0 */}
        <path
          d="M30 4.2
             L56.5 55.8 
             C57.1 57.0 56.2 58.5 54.8 58.5 
             L5.2 58.5 
             C3.8 58.5 2.9 57.0 3.5 55.8 
             L30 4.2 Z"
          fill="url(#emblemBg)"
          stroke="url(#emblemBorder)"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />

        {/* Inner architectural hairline: Exactly centered around X = 30.0 */}
        <path
          d="M30 9.5 
             L53.2 54.5 
             L6.8 54.5 Z"
          fill="none"
          stroke="url(#innerGlow)"
          strokeWidth="0.75"
          strokeOpacity="0.35"
        />

        {/* Precision Architectural Capital "A": Symmetrically centered around X = 30.0 */}
        <g id="letter-A">
          <path
            d="M30 20.5
               L22.2 46.5
               H26.2
               L28.1 39.8
               H31.9
               L33.8 46.5
               H37.8
               L30 20.5 Z
               M30 27.8
               L31.2 36.2
               H28.8
               L30 27.8 Z"
            fill="#E8E1DA"
            fillRule="evenodd"
          />
        </g>
      </svg>
    </div>
  );
}
