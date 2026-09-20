import { useState } from 'react'
import { enrollPerson } from '../services/api'
import ImageUploader from './ImageUploader'
import ResultBadge from './ResultBadge'

/**
 * EnrollSection — complete enrollment workflow.
 *
 * State:
 *   name     : controlled text input
 *   images   : selected File objects (max 3)
 *   previews : object URL strings for previews
 *   loading  : request in flight
 *   result   : backend response object
 *   error    : top-level error string
 */
export default function EnrollSection() {
  const [name, setName] = useState('')
  const [images, setImages] = useState([])
  const [previews, setPreviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleImageChange = (files, prevs) => {
    setImages(files)
    setPreviews(prevs)
    // Clear previous result when selection changes
    setResult(null)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Basic frontend validation with auto-focus
    if (!name.trim()) {
      setError('Please enter a full name above before enrolling.')
      document.getElementById('enroll-name')?.focus()
      return
    }
    if (images.length === 0) {
      setError('Please select at least 1 face image (up to 3).')
      return
    }

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const data = await enrollPerson(name.trim(), images)

      // Backend returned a top-level error (0 or >3 images check at route level)
      if (data.status === 'error') {
        setError(data.message)
      } else {
        setResult(data)
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Network error — is the backend running?'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    previews.forEach((p) => URL.revokeObjectURL(p))
    setName('')
    setImages([])
    setPreviews([])
    setResult(null)
    setError(null)
  }

  const hasResult = result !== null

  return (
    <section
      id="enroll"
      style={{
        padding: '100px 24px',
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
              Step 1
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
            Enroll a Person
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
            Add up to 3 face images for a person. Each image must contain exactly
            one clear face.
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px 28px 32px' }}>
          <form onSubmit={handleSubmit} noValidate>
            {/* Name field */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="enroll-name" className="field-label">
                Full Name
              </label>
              <input
                id="enroll-name"
                className="input-field"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="e.g. Elon Musk"
                disabled={loading}
                autoComplete="off"
                maxLength={80}
              />
            </div>

            {/* Image uploader */}
            <div style={{ marginBottom: '24px' }}>
              <label className="field-label">Face Images (max 3)</label>
              <ImageUploader
                images={images}
                previews={previews}
                onChange={handleImageChange}
                disabled={loading}
              />
            </div>

            {/* Inline error */}
            {error && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--color-error-dim)',
                  border: '1px solid rgba(217,92,92,0.2)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-error)',
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                id="enroll-submit-btn"
                style={{ minWidth: '120px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Enrolling…
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
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21a8 8 0 0 0-16 0" />
                    </svg>
                    Enroll
                  </>
                )}
              </button>

              {(hasResult || images.length > 0 || name) && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleReset}
                  disabled={loading}
                  id="enroll-reset-btn"
                >
                  Reset
                </button>
              )}
            </div>
          </form>

          {/* Result panel */}
          {hasResult && <EnrollResult result={result} />}
        </div>
      </div>
    </section>
  )
}

/**
 * EnrollResult — displays the full enrollment response.
 * Shows enrolled_count, skipped_count, rejected_count + per-image details.
 */
function EnrollResult({ result }) {
  const { person_name, enrolled_count, skipped_count, rejected_count, details, message } = result

  const allRejected = enrolled_count === 0 && skipped_count === 0
  const someEnrolled = enrolled_count > 0

  return (
    <div style={{ marginTop: '28px' }}>
      <div className="section-divider" style={{ marginBottom: '24px' }} />

      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '20px',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              color: 'var(--color-text-primary)',
              marginBottom: '2px',
            }}
          >
            {person_name}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
            }}
          >
            {message}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {enrolled_count > 0 && (
            <CountChip label="enrolled" count={enrolled_count} color="var(--color-success)" bg="var(--color-success-dim)" />
          )}
          {skipped_count > 0 && (
            <CountChip label="skipped" count={skipped_count} color="var(--color-warning)" bg="var(--color-warning-dim)" />
          )}
          {rejected_count > 0 && (
            <CountChip label="rejected" count={rejected_count} color="var(--color-error)" bg="var(--color-error-dim)" />
          )}
        </div>
      </div>

      {/* Per-image details */}
      {details && details.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {details.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: '8px',
                padding: '10px 14px',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-text-muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.image}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {item.status !== 'enrolled' && (
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {item.reason}
                  </span>
                )}
                <ResultBadge status={item.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Informative notice if max enrolled limit was reached in backend */}
      {details?.some((d) => d.reason?.toLowerCase().includes('maximum 3')) && (
        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-warning-dim)',
            border: '1px solid rgba(232,160,48,0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-warning)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            This person already has 3 images saved in the vector database (the backend limit per identity). To enroll a new person, enter a different name.
          </span>
        </div>
      )}
    </div>
  )
}

function CountChip({ label, count, color, bg }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: '9999px',
        padding: '4px 12px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '14px',
          color,
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          fontWeight: '500',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </span>
    </div>
  )
}
