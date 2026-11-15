'use client';

import React, { useState, useEffect, useRef } from 'react';

interface HeroBackgroundProps {
  videoSrc?: string;
  posterSrc?: string;
  wordmarkSrc?: string;
  playbackSpeed?: number;
  showWordmark?: boolean;
  className?: string;
}

export function HeroBackground({
  videoSrc = '/media/hero/afterfact-hero.mp4',
  posterSrc = '/media/hero/afterfact-hero-poster.webp',
  wordmarkSrc = '/media/hero/afterfact-wordmark-transparent.png',
  playbackSpeed = 0.6,
  showWordmark = false,
  className = '',
}: HeroBackgroundProps) {
  const [videoError, setVideoError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Enforce properties required for strict browser autoplay policies
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    // Set cinematic slow-motion playback speed
    const applySpeed = () => {
      if (video) {
        video.playbackRate = playbackSpeed;
      }
    };

    applySpeed();

    const attemptPlay = () => {
      applySpeed();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback if browser requires interaction
        });
      }
    };

    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      video.addEventListener('canplay', attemptPlay, { once: true });
      video.addEventListener('loadeddata', attemptPlay, { once: true });
    }

    video.addEventListener('play', applySpeed);

    attemptPlay();

    return () => {
      video.removeEventListener('canplay', attemptPlay);
      video.removeEventListener('loadeddata', attemptPlay);
      video.removeEventListener('play', applySpeed);
    };
  }, [videoSrc, playbackSpeed]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none -z-10 overflow-hidden bg-[#111214] select-none ${className}`}
      aria-hidden="true"
    >
      {/* 1. NATIVE HTML VIDEO ELEMENT WITH DYNAMIC COLOR GRADING */}
      {!videoError ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={posterSrc}
          src={videoSrc}
          onError={() => setVideoError(true)}
          className="hero-video absolute inset-0 w-full h-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : (
        /* STATIC POSTER FALLBACK ONLY ON VIDEO ERROR */
        posterSrc && (
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${posterSrc})`,
              filter:
                'brightness(var(--hero-video-brightness, 0.68)) contrast(var(--hero-video-contrast, 0.94)) saturate(var(--hero-video-saturation, 0.30))',
            }}
          />
        )
      )}

      {/* 2. DEDICATED DARK CINEMATIC OVERLAY */}
      <div className="hero-video-overlay" />

      {/* Subtle additional directional vignettes for left headline & right cards */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#111214]/60 via-transparent to-[#111214]/70 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111214] via-[#111214]/30 to-[#111214]/70 pointer-events-none" />

      {/* 3. OPTIONAL WORDMARK IN BACKGROUND ONLY IF EXPLICITLY ENABLED */}
      {showWordmark && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={wordmarkSrc}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="hero-wordmark pointer-events-none select-none"
        />
      )}

      {/* 4. ANALOG 35MM MONOCHROMATIC FILM GRAIN TEXTURE */}
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

      {/* 5. SEAMLESS VERTICAL TRANSITION TO LOWER PAGE */}
      <div
        className="absolute inset-x-0 bottom-0 h-64 sm:h-80 lg:h-96 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(16, 16, 18, 0.25) 30%, rgba(16, 16, 18, 0.75) 70%, #101012 100%)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
