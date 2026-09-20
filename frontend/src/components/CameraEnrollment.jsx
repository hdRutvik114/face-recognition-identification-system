import { useCallback, useEffect, useRef, useState } from 'react'
import { enrollPerson } from '../services/api'
import { EnrollResult } from './EnrollSection'

const CAPTURE_STEPS = [
  {
    step: 1,
    title: 'Look straight at the camera',
    subtitle: 'Keep a relaxed, neutral expression centered in the frame',
    badge: 'Neutral',
    filename: 'camera_capture_1.jpg',
  },
  {
    step: 2,
    title: 'Give a small smile',
    subtitle: 'Only a slight natural smile while staying centered',
    badge: 'Small Smile',
    filename: 'camera_capture_2.jpg',
  },
  {
    step: 3,
    title: 'Turn your face slightly',
    subtitle: 'Only a very small left or right angle variation',
    badge: 'Slight Angle',
    filename: 'camera_capture_3.jpg',
  },
]

/**
 * Lightweight frontend validation for a captured camera frame:
 * 1. Checks for extreme dark (avg luminance < 32) or extreme bright (> 228).
 * 2. Checks for face visibility:
 *    - First attempts native window.FaceDetector if available.
 *    - Falls back to a lightweight contrast & skin-tone density check in the center oval region.
 *
 * This check provides fast user feedback while keeping the backend as the final authority.
 */
async function validateCapturedQuality(canvas, ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data

  // 1. Lighting / Brightness check
  let totalLuminance = 0
  let sampleCount = 0
  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    totalLuminance += lum
    sampleCount++
  }

  const avgBrightness = totalLuminance / sampleCount

  // Extremely dark or extremely bright
  if (avgBrightness < 20 || avgBrightness > 238) {
    return {
      valid: false,
      reason: 'The image is too dark or too bright. Please adjust the lighting and take the photo again.',
    }
  }

  // 2. Face Visibility Check
  // A) Browser Native FaceDetector API (Chrome / Edge / Opera)
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
      const faces = await detector.detect(canvas)
      if (!faces || faces.length === 0) {
        return {
          valid: false,
          reason: 'No face detected. Please position your face inside the frame and take the photo again.',
        }
      }
      return { valid: true }
    } catch (_) {
      // Fall through to heuristic if detector fails
    }
  }

  // B) Fallback: Central Region Variance & Skin-tone density
  const xStart = Math.floor(width * 0.25)
  const xEnd = Math.floor(width * 0.75)
  const yStart = Math.floor(height * 0.15)
  const yEnd = Math.floor(height * 0.85)

  let centerLuminances = []
  let skinTonePixels = 0
  let centerPixelCount = 0

  for (let y = yStart; y < yEnd; y += 4) {
    for (let x = xStart; x < xEnd; x += 4) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b

      centerLuminances.push(lum)
      centerPixelCount++

      // Standard YCbCr skin-tone boundaries (covers diverse human skin complexions)
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

      if (cb >= 77 && cb <= 135 && cr >= 130 && cr <= 175) {
        skinTonePixels++
      }
    }
  }

  // Standard deviation in the center region
  const centerMean = centerLuminances.reduce((a, b) => a + b, 0) / centerPixelCount
  const centerVariance =
    centerLuminances.reduce((sum, val) => sum + Math.pow(val - centerMean, 2), 0) / centerPixelCount
  const centerStdDev = Math.sqrt(centerVariance)
  const skinRatio = skinTonePixels / centerPixelCount

  // Flat/blank surface (covered camera, blank wall, uniform background)
  // Or if skin-tone pixels are virtually absent and edge contrast is low
  if (centerStdDev < 8 || (skinRatio < 0.015 && centerStdDev < 18)) {
    return {
      valid: false,
      reason: 'No face detected. Please position your face inside the frame and take the photo again.',
    }
  }

  return { valid: true }
}

export default function CameraEnrollment({ name, onNameChange }) {
  const [stage, setStage] = useState('idle') // 'idle' | 'capturing' | 'review' | 'result'
  const [currentIndex, setCurrentIndex] = useState(0)
  const [captures, setCaptures] = useState([null, null, null])
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [backendResult, setBackendResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [qualityError, setQualityError] = useState(null) // { message: string, previewUrl: string }
  const [flash, setFlash] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Safe camera stream terminator
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (_) {}
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  // Dedicated callback ref for the video element so stream attaches immediately upon mounting
  const setVideoRef = useCallback((node) => {
    videoRef.current = node
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current
      }
      node.play().catch((err) => {
        console.warn('Video auto-play warning:', err)
      })
    }
  }, [])

  // Sync streamRef to videoRef whenever stage changes to 'capturing' or cameraActive updates
  useEffect(() => {
    if (stage === 'capturing' && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
      }
      videoRef.current.play().catch((err) => {
        console.warn('Video auto-play warning:', err)
      })
    }
  }, [stage, cameraActive])

  // Always clean up camera when unmounting
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Start camera stream
  const startCamera = async () => {
    if (!name.trim()) {
      setErrorMsg('Please enter a full name above before starting camera.')
      document.getElementById('enroll-name')?.focus()
      return
    }

    setCameraError(null)
    setErrorMsg(null)
    setQualityError(null)

    try {
      stopCamera()

      let mediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch (firstErr) {
        console.warn('Ideal video constraints failed, trying basic video constraint:', firstErr)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = mediaStream
      setCameraActive(true)
      setStage('capturing')

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      console.error('Camera access error:', err)
      let message = 'Could not access device camera.'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please allow camera access in your browser settings to proceed.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera device found on this system.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is in use by another application or tab.'
      }
      setCameraError(message)
    }
  }

  // Capture current video frame to Blob & File with lightweight quality check
  const captureFrame = async () => {
    if (!videoRef.current || !streamRef.current || !cameraActive) return

    const video = videoRef.current
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480

    if (width <= 0 || height <= 0) {
      console.warn('Video frame dimensions are 0, cannot capture yet')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    // Mirror horizontally so saved image matches user's mirrored mirror-view
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, width, height)

    // Visual shutter flash
    setFlash(true)
    setTimeout(() => setFlash(false), 200)

    // Run lightweight frontend quality validation
    const quality = await validateCapturedQuality(canvas, ctx, width, height)
    if (!quality.valid) {
      const rejectedUrl = canvas.toDataURL('image/jpeg', 0.85)
      setQualityError({
        message: quality.reason,
        previewUrl: rejectedUrl,
      })
      return
    }

    setQualityError(null)

    canvas.toBlob(
      (blob) => {
        if (!blob) return

        const stepInfo = CAPTURE_STEPS[currentIndex]
        const file = new File([blob], stepInfo.filename, { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)

        const updated = [...captures]
        // Revoke previous object URL if replacing
        if (updated[currentIndex]?.previewUrl) {
          URL.revokeObjectURL(updated[currentIndex].previewUrl)
        }
        updated[currentIndex] = { file, previewUrl, label: stepInfo.badge }
        setCaptures(updated)

        // Check if this was the last capture needed
        const nextMissingIndex = updated.findIndex((c) => c === null)
        if (nextMissingIndex === -1) {
          // All 3 captures complete -> go to review
          setStage('review')
          stopCamera()
        } else {
          // Advance to the next capture slot
          setCurrentIndex(nextMissingIndex)
        }
      },
      'image/jpeg',
      0.95
    )
  }

  // Retake a specific capture slot
  const handleRetake = (index) => {
    setQualityError(null)
    setCurrentIndex(index)
    setStage('capturing')
    startCamera()
  }

  // Reset entire camera flow
  const handleResetAll = () => {
    setQualityError(null)
    captures.forEach((c) => {
      if (c?.previewUrl) URL.revokeObjectURL(c.previewUrl)
    })
    setCaptures([null, null, null])
    setCurrentIndex(0)
    setStage('idle')
    setBackendResult(null)
    setErrorMsg(null)
    stopCamera()
  }

  // Submit all 3 captures to existing /enroll API
  const handleSubmitEnrollment = async () => {
    const files = captures.filter(Boolean).map((c) => c.file)
    if (files.length !== 3) {
      setErrorMsg('Please capture all 3 required images before submitting.')
      return
    }
    if (!name.trim()) {
      setErrorMsg('Please enter a full name above before enrolling.')
      document.getElementById('enroll-name')?.focus()
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const data = await enrollPerson(name.trim(), files)
      if (data.status === 'error') {
        setErrorMsg(data.message)
      } else {
        setBackendResult(data)
        setStage('result')
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Network error — could not submit enrollment.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const currentStep = CAPTURE_STEPS[currentIndex]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top inline error */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-error-dim)',
            border: '1px solid rgba(217,92,92,0.25)',
            borderRadius: '8px',
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-error)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stage: IDLE (Prompt to Start Camera) */}
      {stage === 'idle' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 20px',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.015)',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(245,200,66,0.08)',
              border: '1px solid rgba(245,200,66,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>

          <div>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '18px',
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
              }}
            >
              Guided Camera Enrollment
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                maxWidth: '440px',
                lineHeight: '1.5',
              }}
            >
              Capture 3 quick face angles (Neutral, Small Smile, Subtle Angle) using your webcam for high-accuracy recognition.
            </p>
          </div>

          {cameraError && (
            <div
              style={{
                background: 'var(--color-error-dim)',
                border: '1px solid rgba(217,92,92,0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--color-error)',
                maxWidth: '480px',
              }}
            >
              {cameraError}
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={startCamera}
            id="start-camera-btn"
            style={{ marginTop: '8px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Face Camera
          </button>
        </div>
      )}

      {/* Stage: CAPTURING (Camera Preview + Apple Face ID-inspired frame) */}
      {stage === 'capturing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Step Progress Tracker */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '12px 18px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--color-accent)',
                  background: 'var(--color-accent-dim)',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                }}
              >
                Step {currentIndex + 1} of 3
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '14px',
                  color: 'var(--color-text-primary)',
                }}
              >
                {currentStep.title}
              </span>
            </div>

            {/* 3 Status indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {CAPTURE_STEPS.map((s, idx) => {
                const isCaptured = captures[idx] !== null
                const isCurrent = currentIndex === idx
                return (
                  <div
                    key={s.step}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-body)',
                      color: isCaptured
                        ? 'var(--color-success)'
                        : isCurrent
                        ? 'var(--color-accent)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    <span>{isCaptured ? '✓' : isCurrent ? '●' : '○'}</span>
                    <span style={{ display: 'inline' }}>{s.badge}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Camera Viewport with Face Positioning Guide */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4/3',
              maxWidth: '640px',
              margin: '0 auto',
              borderRadius: '18px',
              overflow: 'hidden',
              background: '#030406',
              border: qualityError
                ? '2px solid var(--color-error)'
                : '1px solid var(--color-border-strong)',
              boxShadow: qualityError
                ? '0 0 24px rgba(217,92,92,0.3)'
                : '0 8px 32px rgba(0,0,0,0.6)',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Live Video Feed (mirrored for natural look) */}
            <video
              ref={setVideoRef}
              playsInline
              autoPlay
              muted
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(console.warn)
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: qualityError ? 'none' : 'block',
              }}
            />

            {/* Frozen Rejected Capture Preview (overlay) */}
            {qualityError && (
              <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <img
                  src={qualityError.previewUrl}
                  alt="Rejected capture"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '14px',
                    left: '14px',
                    background: 'rgba(217, 92, 92, 0.92)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    fontWeight: '600',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  }}
                >
                  Capture Rejected
                </div>
              </div>
            )}

            {/* Shutter flash animation */}
            {flash && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#ffffff',
                  opacity: 0.85,
                  transition: 'opacity 0.2s ease-out',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            )}

            {/* Face ID-inspired Oval Guide Overlay (hidden during rejected freeze) */}
            {!qualityError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}
              >
                {/* Center Oval Frame */}
                <div
                  style={{
                    width: 'min(58vw, 240px)',
                    height: 'min(76vw, 310px)',
                    borderRadius: '50%',
                    border: '2px dashed rgba(245, 200, 66, 0.65)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.38)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px 0',
                  }}
                >
                  {/* Top instruction text inside frame */}
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: 'var(--color-accent)',
                      background: 'rgba(7, 8, 10, 0.75)',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      letterSpacing: '0.04em',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    Position face inside
                  </span>

                  {/* Subtle alignment crosshair indicator */}
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.7)',
                      background: 'rgba(7, 8, 10, 0.65)',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {currentStep.subtitle}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quality Error Notification Banner */}
          {qualityError && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                background: 'var(--color-error-dim)',
                border: '1px solid rgba(217, 92, 92, 0.32)',
                borderRadius: '12px',
                padding: '14px 18px',
                fontFamily: 'var(--font-body)',
                fontSize: '13.5px',
                color: 'var(--color-error)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ lineHeight: '1.45', fontWeight: '500' }}>{qualityError.message}</span>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setQualityError(null)}
                style={{ height: '38px', padding: '0 18px', fontSize: '13px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Retake Photo
              </button>
            </div>
          )}

          {/* Shutter and Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              padding: '12px 0',
            }}
          >
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setQualityError(null)
                stopCamera()
                setStage('idle')
              }}
              style={{ padding: '0 16px', height: '44px', fontSize: '14px' }}
            >
              Cancel
            </button>

            {/* Apple Camera-style Shutter Button (hidden when rejected, replaced by Retake) */}
            {qualityError ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setQualityError(null)}
                style={{ height: '46px', padding: '0 24px', fontSize: '14px' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Retake Photo
              </button>
            ) : (
              <button
                type="button"
                onClick={captureFrame}
                id="camera-shutter-btn"
                aria-label="Capture Photo"
                title="Capture Photo"
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'transparent',
                  border: '4px solid #ffffff',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease, filter 0.2s ease',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'var(--color-accent)',
                    boxShadow: '0 0 12px rgba(245,200,66,0.4)',
                  }}
                />
              </button>
            )}

            <div style={{ width: '64px' }} />
          </div>

          {/* Thumbnail strip showing captures so far */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
            }}
          >
            {CAPTURE_STEPS.map((s, idx) => {
              const cap = captures[idx]
              const isCurrent = currentIndex === idx

              return (
                <div
                  key={s.step}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${
                      isCurrent
                        ? 'var(--color-accent)'
                        : cap
                        ? 'rgba(76,175,125,0.3)'
                        : 'var(--color-border)'
                    }`,
                    borderRadius: '10px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '4/3',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      background: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {cap ? (
                      <img
                        src={cap.previewUrl}
                        alt={s.badge}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {isCurrent ? 'Current' : 'Waiting'}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-body)',
                      color: cap ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.badge} {cap && '✓'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stage: REVIEW (Review 3 Photos Before Submit) */}
      {stage === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--color-success)',
                }}
              >
                All 3 Captures Ready
              </span>
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '20px',
                color: 'var(--color-text-primary)',
                marginBottom: '4px',
              }}
            >
              Review Enrollment Photos
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
              }}
            >
              Verify your 3 photos below. You can retake any image if needed, or submit for enrollment.
            </p>
          </div>

          {/* 3 Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {CAPTURE_STEPS.map((s, idx) => {
              const cap = captures[idx]
              return (
                <div
                  key={s.step}
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '4/3',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#000',
                    }}
                  >
                    {cap?.previewUrl && (
                      <img
                        src={cap.previewUrl}
                        alt={s.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'var(--color-accent)',
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Photo {s.step}
                    </span>
                  </div>

                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '13px',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {s.badge}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '11.5px',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {s.title}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => handleRetake(idx)}
                    disabled={submitting}
                    style={{
                      padding: '0 12px',
                      height: '32px',
                      fontSize: '12px',
                      marginTop: 'auto',
                    }}
                  >
                    Retake Photo
                  </button>
                </div>
              )
            })}
          </div>

          {/* Review Actions */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSubmitEnrollment}
              disabled={submitting}
              id="camera-enroll-submit-btn"
              style={{ minWidth: '160px' }}
            >
              {submitting ? (
                <>
                  <span className="spinner" />
                  Enrolling face…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Submit Enrollment
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={handleResetAll}
              disabled={submitting}
            >
              Retake All
            </button>
          </div>
        </div>
      )}

      {/* Stage: RESULT (Backend Enrollment Response) */}
      {stage === 'result' && backendResult && (
        <div>
          <EnrollResult result={backendResult} />
          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleResetAll}
              style={{ minWidth: '150px' }}
            >
              Enroll Another Person
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
