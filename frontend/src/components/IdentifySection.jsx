import { useEffect, useRef, useState } from 'react'
import { identifyPerson } from '../services/api'
import Toast from './Toast'

// Identification threshold — confirmed hardcoded in identification_service.py
const THRESHOLD = 0.65

/**
 * IdentifySection — complete identification workflow.
 *
 * Backend status values (all confirmed from source):
 *   "identified" — person matched above threshold
 *   "unknown"    — best match below threshold, or DB empty
 *   "multiple"   — multiple faces detected
 *   "error"      — no face, unreadable image, etc.
 */
export default function IdentifySection() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const toastTimer = useRef(null)

  // Auto-dismiss toast
  const showToast = (message, type = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (preview) URL.revokeObjectURL(preview)
  }, [])

  const selectFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (preview) URL.revokeObjectURL(preview)
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setResult(null)
  }

  const handleFileInput = (e) => {
    selectFile(e.target.files?.[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (loading) return
    selectFile(e.dataTransfer.files?.[0])
  }

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setImage(null)
    setPreview(null)
    setResult(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!image) return

    setLoading(true)
    setResult(null)

    try {
      const data = await identifyPerson(image)
      setResult(data)
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Network error — is the backend running?'
      showToast(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="identify"
      style={{
        padding: '100px 24px 140px',
        scrollMarginTop: '80px',
      }}
    >
      <div className="section-container">
        {/* Section header */}
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--color-accent)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
              }}
            >
              Step 2
            </span>
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(26px, 4vw, 38px)',
              fontWeight: '400',
              color: 'var(--color-text-primary)',
              marginBottom: '10px',
            }}
          >
            Identify a Face
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.6',
              maxWidth: '500px',
            }}
          >
            Upload a single image. The system will match it against enrolled faces
            or reject the unknown.
          </p>
        </div>

        {/* Card — two-column on wide, stacked on small */}
        <div
          className="card"
          style={{
            padding: '28px',
            display: 'grid',
            gridTemplateColumns: preview ? '1fr 1fr' : '1fr',
            gap: '28px',
            transition: 'grid-template-columns 0.3s ease',
          }}
        >
          {/* Left: upload */}
          <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" style={{ marginBottom: '10px' }}>
              Image
            </label>

            {/* Drop zone or preview thumbnail */}
            {preview ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border-strong)',
                  marginBottom: '16px',
                }}
              >
                <img
                  src={preview}
                  alt="Selected face"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {!loading && (
                  <button
                    type="button"
                    className="preview-remove"
                    onClick={handleReset}
                    aria-label="Remove selected image"
                    style={{ top: '8px', right: '8px', width: '26px', height: '26px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`drop-zone${dragging ? ' dragging' : ''}`}
                style={{ marginBottom: '16px', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                role="button"
                tabIndex={loading ? -1 : 0}
                aria-label="Select or drag an image to identify"
                onClick={() => !loading && inputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && !loading && inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true) }}
                onDragLeave={() => setDragging(false)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={dragging ? 'var(--color-accent)' : 'var(--color-text-muted)'}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'stroke 0.2s' }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="10" r="3" />
                    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
                  </svg>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: dragging ? 'var(--color-accent)' : 'var(--color-text-secondary)', transition: 'color 0.2s' }}>
                    Click or drag a face image
                  </p>
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInput}
              disabled={loading}
              id="identify-file-input"
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !image}
                id="identify-submit-btn"
                style={{ minWidth: '120px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Identifying…
                  </>
                ) : (
                  <>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Identify
                  </>
                )}
              </button>
              {(image || result) && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleReset}
                  disabled={loading}
                  id="identify-reset-btn"
                >
                  Reset
                </button>
              )}
            </div>
          </form>

          {/* Right: result */}
          {result && <IdentifyResult result={result} />}
        </div>
      </div>

      {/* Toast for network errors */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Responsive: stack on small screens */}
      <style>{`
        @media (max-width: 600px) {
          #identify .card {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}

/**
 * IdentifyResult — renders the correct state panel based on backend status.
 *
 * status values from backend:
 *   "identified" — matched above threshold
 *   "unknown"    — below threshold or empty DB
 *   "multiple"   — multiple faces detected
 *   "error"      — no face, unreadable image
 */
function IdentifyResult({ result }) {
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
