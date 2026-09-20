import { useEffect, useRef } from 'react'
import heroVideo from '../assets/4b3c0e7f-5d46-4edb-bae4-3eb5b074be8a.mp4'

/**
 * Hero — full-viewport cinematic landing section.
 *
 * Features:
 *  - Full-bleed looping background video (muted, autoPlay, playsInline).
 *  - Multi-layer gradient overlay for text legibility across all video frames.
 *  - Staggered fade-up entrance animations for each content element.
 *  - Left-aligned layout on desktop (matching reference), centered on mobile.
 *  - Smooth video loop (CSS fade trick via opacity keyframe near end).
 *  - Respects prefers-reduced-motion — falls back to instant appearance.
 */
export default function Hero() {
  const videoRef = useRef(null)

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  // Subtle cross-fade on loop: fade out near end, fade back in at start
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      if (!video.duration) return
      const remaining = video.duration - video.currentTime
      // Start fading 0.8s before loop point
      if (remaining < 0.8) {
        const opacity = remaining / 0.8
        video.style.opacity = opacity.toFixed(3)
      } else if (video.style.opacity !== '1') {
        video.style.opacity = '1'
      }
    }

    const handleSeeked = () => {
      // After loop seek back to 0, fade in
      video.style.opacity = '0'
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          video.style.transition = 'opacity 0.4s ease'
          video.style.opacity = '1'
        })
      })
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('seeked', handleSeeked)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [])

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* ── Background Video ── */}
      <video
        ref={videoRef}
        src={heroVideo}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 0,
          transition: 'opacity 0.3s ease',
          willChange: 'opacity',
        }}
      />

      {/* ── Gradient Overlay (multi-layer for universal readability) ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: [
            /* Left-side dark ramp so left-aligned text always pops */
            'linear-gradient(105deg, rgba(7,8,10,0.88) 0%, rgba(7,8,10,0.60) 45%, rgba(7,8,10,0.25) 75%, rgba(7,8,10,0.10) 100%)',
            /* Global bottom-to-top dark base so hero feels grounded */
            'linear-gradient(to top, rgba(7,8,10,0.70) 0%, rgba(7,8,10,0.10) 40%, transparent 70%)',
            /* Top vignette to blend into navbar */
            'linear-gradient(to bottom, rgba(7,8,10,0.50) 0%, transparent 20%)',
          ].join(', '),
        }}
      />

      {/* ── Content ── */}
      <div
        className="hero-content"
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '120px 56px 100px',
        }}
      >
        {/* Eyebrow badge */}
        <div
          className="hero-anim hero-anim-1"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(245,200,66,0.10)',
            border: '1px solid rgba(245,200,66,0.28)',
            borderRadius: '9999px',
            padding: '5px 14px',
            marginBottom: '28px',
          }}
        >
          {/* Bracket left */}
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '11px',
              color: 'var(--color-accent)',
              opacity: 0.6,
              letterSpacing: '0',
            }}
          >
            [
          </span>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-accent)',
              flexShrink: 0,
              boxShadow: '0 0 8px rgba(245,200,66,0.6)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '600',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
            }}
          >
            Code Nimbus
          </span>
          {/* Bracket right */}
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '11px',
              color: 'var(--color-accent)',
              opacity: 0.6,
            }}
          >
            ]
          </span>
        </div>

        {/* Headline */}
        <h1
          className="hero-anim hero-anim-2"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(36px, 5.5vw, 72px)',
            fontWeight: '400',
            lineHeight: '1.12',
            color: '#ffffff',
            marginBottom: '22px',
            letterSpacing: '-0.01em',
            maxWidth: '680px',
            textShadow: '0 2px 24px rgba(0,0,0,0.55)',
          }}
        >
          Know who's there.
        </h1>

        {/* Sub-copy */}
        <p
          className="hero-anim hero-anim-3"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(15px, 1.8vw, 18px)',
            fontWeight: '400',
            color: 'rgba(240,237,232,0.82)',
            lineHeight: '1.65',
            marginBottom: '48px',
            maxWidth: '480px',
            textShadow: '0 1px 12px rgba(0,0,0,0.5)',
          }}
        >
          Enroll a face. Identify it instantly. Confidently reject the unknown.
        </p>

        {/* CTA Buttons */}
        <div
          className="hero-anim hero-anim-4"
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn-primary"
            onClick={() => scrollTo('enroll')}
            id="hero-enroll-cta"
            style={{
              height: '52px',
              padding: '0 32px',
              fontSize: '15px',
              boxShadow: '0 4px 20px rgba(245,200,66,0.25)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
            Enroll a Person
          </button>

          <button
            className="btn-ghost"
            onClick={() => scrollTo('identify')}
            id="hero-identify-cta"
            style={{
              height: '52px',
              padding: '0 28px',
              fontSize: '15px',
              borderColor: 'rgba(255,255,255,0.28)',
              color: '#fff',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            Identify a Face
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <div
        className="hero-anim hero-anim-5"
        style={{
          position: 'absolute',
          bottom: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(255,255,255,0.38)',
          fontSize: '10px',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-body)',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'heroScrollBounce 2.4s ease-in-out infinite' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        scroll
      </div>

      {/* ── Keyframes & Responsive ── */}
      <style>{`
        /* Entrance animation */
        @keyframes heroFadeUp {
          from {
            opacity: 0;
            transform: translateY(22px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Scroll chevron bounce */
        @keyframes heroScrollBounce {
          0%, 100% { transform: translateY(0);   opacity: 0.3; }
          50%       { transform: translateY(6px); opacity: 0.65; }
        }

        .hero-anim {
          opacity: 0;
          animation: heroFadeUp 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .hero-anim-1 { animation-delay: 0.15s; }
        .hero-anim-2 { animation-delay: 0.30s; }
        .hero-anim-3 { animation-delay: 0.46s; }
        .hero-anim-4 { animation-delay: 0.62s; }
        .hero-anim-5 { animation-delay: 1.10s; }

        /* Tablet */
        @media (max-width: 768px) {
          .hero-content {
            padding: 110px 32px 80px !important;
          }
        }

        /* Mobile */
        @media (max-width: 520px) {
          .hero-content {
            padding: 100px 20px 72px !important;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
        }

        /* Reduced motion — skip animation, show instantly */
        @media (prefers-reduced-motion: reduce) {
          .hero-anim {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </section>
  )
}
