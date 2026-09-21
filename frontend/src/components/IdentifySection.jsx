import { useEffect, useRef, useState } from 'react'
import { identifyPerson } from '../services/api'
import CameraIdentify from './CameraIdentify'
import IdentifyResult from './IdentifyResult'
import Toast from './Toast'

// Identification threshold — confirmed hardcoded in identification_service.py
const THRESHOLD = 0.65

/**
 * IdentifySection — complete identification workflow.
 *
 * Supports two identification methods:
 *   - "camera" : Instant 1-shot camera capture & identification
 *   - "upload" : File-based single image uploader
 *
 * Backend status values (all confirmed from source):
 *   "identified" — person matched above threshold
 *   "unknown"    — best match below threshold, or DB empty
 *   "multiple"   — multiple faces detected
 *   "error"      — no face, unreadable image, etc.
 */
export default function IdentifySection() {
  const [identifyMode, setIdentifyMode] = useState('camera')
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

        {/* Card */}
        <div className="card" style={{ padding: '28px 28px 32px' }}>
          {/* Method Switcher: Camera vs Upload */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--color-border)',
              borderRadius: '9999px',
              padding: '4px',
              marginBottom: '26px',
              maxWidth: '380px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIdentifyMode('camera')
                handleReset()
              }}
              id="identify-mode-camera-btn"
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '9999px',
                border: 'none',
                background: identifyMode === 'camera' ? 'var(--color-accent)' : 'transparent',
                color: identifyMode === 'camera' ? '#07080a' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: '13.5px',
                fontWeight: identifyMode === 'camera' ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Live Camera
            </button>
            <button
              type="button"
              onClick={() => {
                setIdentifyMode('upload')
                handleReset()
              }}
              id="identify-mode-upload-btn"
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '9999px',
                border: 'none',
                background: identifyMode === 'upload' ? 'var(--color-accent)' : 'transparent',
                color: identifyMode === 'upload' ? '#07080a' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: '13.5px',
                fontWeight: identifyMode === 'upload' ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Upload File
            </button>
          </div>

          {identifyMode === 'camera' ? (
            <CameraIdentify />
          ) : (
            <div
              style={{
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
          )}
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
