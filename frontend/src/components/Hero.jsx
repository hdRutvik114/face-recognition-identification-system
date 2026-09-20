/**
 * Hero — full-viewport landing section.
 * Communicates: face enrollment, identity matching, unknown-person rejection.
 */
export default function Hero() {
  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '100px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial glow behind the headline */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '560px',
          height: '320px',
          background:
            'radial-gradient(ellipse, rgba(245,200,66,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px' }}>
        {/* Eyebrow */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(245,200,66,0.08)',
            border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: '9999px',
            padding: '5px 14px',
            marginBottom: '32px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-accent)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: '500',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
            }}
          >
            Face Recognition System
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(36px, 6vw, 62px)',
            fontWeight: '400',
            lineHeight: '1.15',
            color: 'var(--color-text-primary)',
            marginBottom: '20px',
            letterSpacing: '-0.01em',
          }}
        >
          Know who's there.
        </h1>

        {/* Sub-copy */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(15px, 2vw, 18px)',
            fontWeight: '400',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6',
            marginBottom: '48px',
            maxWidth: '480px',
            margin: '0 auto 48px',
          }}
        >
          Enroll a face. Identify it instantly. Confidently reject the unknown.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn-primary"
            onClick={() => scrollTo('enroll')}
            id="hero-enroll-cta"
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
              <line x1="12" y1="3" x2="12" y2="13" strokeOpacity="0" />
            </svg>
            Enroll a Person
          </button>
          <button
            className="btn-ghost"
            onClick={() => scrollTo('identify')}
            id="hero-identify-cta"
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

      {/* Scroll indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--color-text-muted)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'bounce 2s ease-in-out infinite' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(5px); opacity: 0.8; }
        }
      `}</style>
    </section>
  )
}
