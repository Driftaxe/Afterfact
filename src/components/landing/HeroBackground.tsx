'use client';

import React, { useState, useEffect, useRef } from 'react';

interface HeroBackgroundProps {
  videoSrc?: string;
  posterSrc?: string;
  className?: string;
}

export function HeroBackground({
  videoSrc = '/media/hero/afterfact-hero.mp4',
  posterSrc = '/media/hero/afterfact-hero-poster.webp',
  className = '',
}: HeroBackgroundProps) {
  const [videoAvailable, setVideoAvailable] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Check user preference for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, []);

  return (
    <div
      className={`absolute inset-0 pointer-events-none -z-10 overflow-hidden bg-[#111214] ${className}`}
      aria-hidden="true"
    >
      {/* Background Video Player with Fallback Architecture */}
      {!reducedMotion && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          poster={posterSrc}
          onCanPlay={() => setVideoAvailable(true)}
          onError={() => setVideoAvailable(false)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            videoAvailable ? 'opacity-35' : 'opacity-0'
          }`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Atmospheric Fallback Canvas (rendered seamlessly when video is pending or unavailable) */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Subtle geometric dot-matrix grid */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.065]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #E7E5E2 1px, transparent 0)`,
            backgroundSize: '36px 36px',
          }}
        />

        {/* Ambient atmospheric dark glow behind cards and typography */}
        <div className="absolute -top-32 right-0 w-[500px] lg:w-[700px] h-[500px] lg:h-[700px] bg-gradient-to-br from-accent/10 via-transparent to-transparent rounded-full blur-3xl opacity-50" />
        <div className="absolute top-1/3 -left-20 w-[450px] h-[450px] bg-status-supported-text/5 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-[#18191C]/60 rounded-full blur-2xl opacity-40" />

        {/* Fine architectural hairline vector overlays */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04] dark:opacity-[0.06]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="0" y1="22%" x2="100%" y2="22%" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
          <line x1="0" y1="78%" x2="100%" y2="78%" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
          <line x1="60%" y1="0" x2="60%" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="8 8" />
        </svg>
      </div>

      {/* Cinematic Dark Vignette & Gradient Overlays for High-Contrast Text Legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#111214]/90 via-[#111214]/65 to-[#111214]" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#111214]/40 to-[#111214]/90" />
    </div>
  );
}
