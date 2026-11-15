# Afterfact Hero Media Assets

This directory reserves media assets for the cinematic background video component (`HeroBackground.tsx`).

## Expected Asset Filenames

1. **Background Video:**
   - Filename: `afterfact-hero.mp4`
   - Location: `public/media/hero/afterfact-hero.mp4`

2. **Poster Image / Fallback:**
   - Filename: `afterfact-hero-poster.webp`
   - Location: `public/media/hero/afterfact-hero-poster.webp`

## Recommended Video Specifications

- **Aspect Ratio:** 16:9 (standard widescreen)
- **Resolution:** 1920×1080 (1080p) or 2560×1440 (1440p)
- **Codec:** H.264 (AVC) with High Profile (level 4.1/4.2) for maximum cross-browser compatibility, or H.265 / VP9.
- **Bitrate:** 2.5 Mbps – 4.5 Mbps (balanced for fast streaming and crisp visuals).
- **Frame Rate:** 24 fps or 30 fps.
- **Audio Track:** None (remove all audio tracks or set silent; web browsers require muted background autoplay).
- **Pixel Format:** `yuv420p` (standard 8-bit color space).
- **Moov Atom:** Web-optimized ("Fast Start") with the index header placed at the beginning of the file.

### Recommended FFmpeg Command for Encoding

```bash
ffmpeg -i input.mov \
  -vcodec libx264 -crf 23 -preset slow \
  -pix_fmt yuv420p \
  -an \
  -movflags +faststart \
  public/media/hero/afterfact-hero.mp4
```

### Poster Generation Command

```bash
ffmpeg -ss 00:00:01 -i public/media/hero/afterfact-hero.mp4 \
  -vframes 1 -q:v 85 \
  public/media/hero/afterfact-hero-poster.webp
```

## How Assets are Loaded by `HeroBackground.tsx`

- If `afterfact-hero.mp4` is present, the `<video>` element plays muted, inline, and on loop.
- If the video has not yet been provided or an error occurs, the component automatically falls back to the dark graphite/charcoal canvas (`#111214`) with subtle ambient atmospheric glows.
- If the user has enabled `prefers-reduced-motion`, video playback is disabled in favor of the static poster or canvas.
