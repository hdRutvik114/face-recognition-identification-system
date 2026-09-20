import { useEffect, useRef } from 'react'

/**
 * Navbar — fixed pill-shaped navigation bar.
 * Smooth-scrolls to #enroll and #identify sections.
 */
export default function Navbar() {
  const navRef = useRef(null)

  // Add a subtle scroll shadow
  useEffect(() => {
    const onScroll = () => {
      if (navRef.current) {
        navRef.current.style.borderColor =
          window.scrollY > 40
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(255,255,255,0.07)'
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(calc(100% - 32px), 820px)',
        height: '58px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px 0 18px',
        borderRadius: '9999px',
        background: 'rgba(7, 8, 10, 0.75)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxSizing: 'border-box',
        transition: 'border-color 0.3s ease',
      }}
    >
      {/* Logo / product name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#07080a"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M3 20c0-4 4-7 9-7s9 3 9 7" />
            <path d="M16 6.5a4 4 0 0 1 0 3" opacity="0.4" />
            <circle cx="19" cy="5" r="1.5" opacity="0.4" />
          </svg>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            color: 'var(--color-text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          FaceID
        </span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <NavLink onClick={() => scrollTo('enroll')}>Enroll</NavLink>
        <span
          style={{
            color: 'rgba(255,255,255,0.15)',
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            margin: '0 2px',
          }}
        >
          /
        </span>
        <NavLink onClick={() => scrollTo('identify')}>Identify</NavLink>
      </div>
    </nav>
  )
}

function NavLink({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-body)',
        fontSize: '13.5px',
        fontWeight: '400',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        padding: '6px 12px',
        borderRadius: '9999px',
        transition: 'color 0.2s, background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--color-text-primary)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--color-text-secondary)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
