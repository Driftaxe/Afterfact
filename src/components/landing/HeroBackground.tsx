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
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);
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
      className={`absolute inset-0 pointer-events-none -z-10 overflow-hidden bg-[#111214] select-none ${className}`}
      aria-hidden="true"
    >
      {/* 1. NATIVE HTML VIDEO ELEMENT WITH DYNAMIC COLOR GRADING */}
      {!reducedMotion && !videoError && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          onLoadedData={() => setVideoLoaded(true)}
          onError={() => setVideoError(true)}
          className={`hero-video absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* STATIC POSTER FALLBACK (WHEN REDUCED MOTION IS ENABLED OR VIDEO FAILS) */}
      {(reducedMotion || videoError || !videoLoaded) && posterSrc && (
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: `url(${posterSrc})`,
            filter: 'brightness(var(--hero-video-brightness, 0.68)) contrast(var(--hero-video-contrast, 0.94)) saturate(var(--hero-video-saturation, 0.30))',
          }}
        />
      )}

      {/* 2. DEDICATED DARK CINEMATIC OVERLAY */}
      <div className="hero-video-overlay" />

      {/* Subtle additional directional vignettes for left headline & right cards */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#111214]/60 via-transparent to-[#111214]/70 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111214] via-[#111214]/30 to-[#111214]/70 pointer-events-none" />

      {/* 3. ANALOG 35MM MONOCHROMATIC FILM GRAIN TEXTURE */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 'var(--hero-grain-opacity, 0.055)' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="afterfact-film-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.85  0 0 0 0 0.85  0 0 0 0 0.85  0 0 0 1 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#afterfact-film-grain)" />
      </svg>
    </div>
  );
}
