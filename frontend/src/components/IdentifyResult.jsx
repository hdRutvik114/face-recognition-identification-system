// Identification threshold — confirmed hardcoded in identification_service.py
const THRESHOLD = 0.65

/**
 * IdentifyResult — renders the correct state panel based on backend status.
 *
 * status values from backend:
 *   "identified" — matched above threshold
 *   "unknown"    — below threshold or empty DB
 *   "multiple"   — multiple faces detected
 *   "error"      — no face, unreadable image
 */
export default function IdentifyResult({ result }) {
  const { status, person_name, score, message } = result

  if (status === 'identified') {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ResultPanel
          type="success"
          icon={<CheckIcon />}
          label="Identified"
          title={person_name}
          rows={[
            { label: 'Similarity', value: score != null ? (score * 100).toFixed(1) + '%' : '—' },
            { label: 'Status', value: message },
          ]}
        />
      </div>
    )
  }

  if (status === 'unknown') {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ResultPanel
          type="unknown"
          icon={<UnknownIcon />}
          label="Unknown Person"
          title="Not recognised"
          rows={[
            score != null
              ? { label: 'Best score', value: (score * 100).toFixed(1) + '%' }
              : null,
            { label: 'Threshold', value: (THRESHOLD * 100).toFixed(0) + '%' },
            { label: 'Note', value: score != null ? 'Score below configured threshold' : message },
          ].filter(Boolean)}
        />
      </div>
    )
  }

  if (status === 'multiple') {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ResultPanel
          type="error"
          icon={<ErrorIcon />}
          label="Rejected"
          title="Multiple faces detected"
          rows={[{ label: 'Detail', value: message }]}
        />
      </div>
    )
  }

  // status === "error" — no face, unreadable image
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <ResultPanel
        type="error"
        icon={<ErrorIcon />}
        label="Rejected"
        title={message}
        rows={[]}
      />
    </div>
  )
}

function ResultPanel({ type, icon, label, title, rows }) {
  const colors = {
    success: { color: 'var(--color-success)', bg: 'var(--color-success-dim)', border: 'rgba(76,175,125,0.2)' },
    unknown: { color: 'var(--color-warning)', bg: 'var(--color-warning-dim)', border: 'rgba(232,160,48,0.2)' },
    error:   { color: 'var(--color-error)',   bg: 'var(--color-error-dim)',   border: 'rgba(217,92,92,0.2)' },
  }
  const c = colors[type]

  return (
    <div
      style={{
        width: '100%',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '12px',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: `${c.color}22`,
            border: `1px solid ${c.color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: c.color,
          }}
        >
          {label}
        </span>
      </div>

      {/* Title */}
      <p
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '20px',
          color: 'var(--color-text-primary)',
          lineHeight: '1.3',
        }}
      >
        {title}
      </p>

      {/* Data rows */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'right',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function UnknownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
