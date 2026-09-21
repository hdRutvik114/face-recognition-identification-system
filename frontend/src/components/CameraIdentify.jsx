import { useCallback, useEffect, useRef, useState } from 'react'
import { identifyPerson } from '../services/api'
import IdentifyResult from './IdentifyResult'

/**
 * Lightweight frontend validation for a captured camera frame:
 * 1. Checks for extreme dark (avg luminance < 20) or extreme bright (> 238).
 * 2. Checks for face visibility:
 *    - Native window.FaceDetector API if available.
 *    - Central region variance & skin-tone density fallback.
 */
async function validateCapturedQuality(canvas, ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data

  // 1. Lighting / Brightness check
  let totalLuminance = 0
  let sampleCount = 0
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    totalLuminance += lum
    sampleCount++
  }

  const avgBrightness = totalLuminance / sampleCount

  if (avgBrightness < 20 || avgBrightness > 238) {
    return {
      valid: false,
      reason: 'The image is too dark or too bright. Please adjust the lighting and take the photo again.',
    }
  }

  // 2. Face Visibility Check
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

  // Fallback: Central Region Variance & Skin-tone density
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

      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

      if (cb >= 77 && cb <= 135 && cr >= 130 && cr <= 175) {
        skinTonePixels++
      }
    }
  }

  const centerMean = centerLuminances.reduce((a, b) => a + b, 0) / centerPixelCount
  const centerVariance =
    centerLuminances.reduce((sum, val) => sum + Math.pow(val - centerMean, 2), 0) / centerPixelCount
  const centerStdDev = Math.sqrt(centerVariance)
  const skinRatio = skinTonePixels / centerPixelCount

  if (centerStdDev < 8 || (skinRatio < 0.015 && centerStdDev < 18)) {
    return {
      valid: false,
      reason: 'No face detected. Please position your face inside the frame and take the photo again.',
    }
  }

  return { valid: true }
}

const SCAN_STEPS = [
  'Detecting face…',
  'Extracting embedding…',
  'Matching identity…',
  'Verifying score…',
]

export default function CameraIdentify() {
  const [stage, setStage] = useState('idle') // 'idle' | 'capturing' | 'result'
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [identifying, setIdentifying] = useState(false)
  const [scanStep, setScanStep] = useState(0)
  const [capturedPreview, setCapturedPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [qualityError, setQualityError] = useState(null)
  const [flash, setFlash] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Cycle scanning step text while identifying
  useEffect(() => {
    if (!identifying) {
      setScanStep(0)
      return
    }
    const interval = setInterval(() => {
      setScanStep((prev) => (prev + 1) % SCAN_STEPS.length)
    }, 550)
    return () => clearInterval(interval)
  }, [identifying])

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

  // Callback ref to attach media stream as soon as video mounts
  const setVideoRef = useCallback((node) => {
    videoRef.current = node
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current
      }
      node.play().catch((err) => {
        console.warn('CameraIdentify: Video play() warning:', err)
      })
    }
  }, [])

  // Keep stream synced whenever stage changes to 'capturing'
  useEffect(() => {
    if (stage === 'capturing' && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
      }
      videoRef.current.play().catch((err) => {
        console.warn('CameraIdentify: Video play() warning:', err)
      })
    }
  }, [stage, cameraActive])

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      if (capturedPreview) URL.revokeObjectURL(capturedPreview)
    }
  }, [stopCamera, capturedPreview])

  // Start webcam
  const startCamera = async () => {
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
        console.warn('Ideal constraints failed, falling back to basic video constraint:', firstErr)
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
      console.error('Camera access error in Identify:', err)
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

  // Capture single frame and send directly to /identify
  const captureAndIdentify = async () => {
    if (!videoRef.current || !streamRef.current || !cameraActive || identifying) return

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

    // Lightweight frontend quality validation
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
    setIdentifying(true)
    setErrorMsg(null)

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setIdentifying(false)
          return
        }

        const file = new File([blob], 'camera_identify.jpg', { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        setCapturedPreview(previewUrl)

        try {
          const data = await identifyPerson(file)
          setResult(data)
          setStage('result')
          stopCamera()
        } catch (err) {
          const msg =
            err?.response?.data?.detail ||
            err?.response?.data?.message ||
            err?.message ||
            'Network error — could not identify face.'
          setErrorMsg(msg)
        } finally {
          setIdentifying(false)
        }
      },
      'image/jpeg',
      0.95
    )
  }

  // Retake / Scan again
  const handleScanAgain = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview)
      setCapturedPreview(null)
    }
    setResult(null)
    setErrorMsg(null)
    setQualityError(null)
    startCamera()
  }

  // Cancel / Reset
  const handleReset = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview)
      setCapturedPreview(null)
    }
    stopCamera()
    setResult(null)
    setErrorMsg(null)
    setQualityError(null)
    setStage('idle')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Error Alert */}
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

      {/* Stage: IDLE */}
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
              Instant Face Identification
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
              Take a quick single-shot photo using your camera to identify yourself against all enrolled members in real time.
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
            id="start-identify-camera-btn"
            style={{ marginTop: '8px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Face Camera
          </button>
        </div>
      )}

      {/* Stage: CAPTURING */}
      {stage === 'capturing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header guidance bar */}
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
                1-Shot Identification
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '14px',
                  color: 'var(--color-text-primary)',
                }}
              >
                Look straight at the camera
              </span>
            </div>

            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
              }}
            >
              Align your face in the oval frame
            </span>
          </div>

          {/* Camera Viewport with Apple Face ID-inspired frame */}
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
            {/* Live Video Feed (mirrored) */}
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

            {/* Face ID-inspired Oval Guide Overlay */}
            {!qualityError && !identifying && (
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
                    Keep steady and centered
                  </span>
                </div>
              </div>
            )}

            {/* Clean Biometric Scanning Overlay */}
            {identifying && (
              <>
                <div className="scan-line" />
                <div className="scan-badge">
                  <span
                    className="spinner"
                    style={{
                      width: '13px',
                      height: '13px',
                      borderWidth: '2px',
                      borderColor: 'rgba(245,200,66,0.3)',
                      borderTopColor: 'var(--color-accent)',
                    }}
                  />
                  {SCAN_STEPS[scanStep]}
                </div>
              </>
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
              onClick={handleReset}
              disabled={identifying}
              style={{ padding: '0 16px', height: '44px', fontSize: '14px' }}
            >
              Cancel
            </button>

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
                onClick={captureAndIdentify}
                disabled={identifying}
                id="camera-identify-shutter-btn"
                aria-label="Capture and Identify"
                title="Capture and Identify"
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
                  cursor: identifying ? 'wait' : 'pointer',
                  opacity: identifying ? 0.7 : 1,
                  transition: 'transform 0.1s ease, filter 0.2s ease',
                }}
                onMouseDown={(e) => !identifying && (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {identifying ? (
                  <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }} />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      boxShadow: '0 0 12px rgba(245,200,66,0.4)',
                    }}
                  />
                )}
              </button>
            )}

            <div style={{ width: '64px' }} />
          </div>
        </div>
      )}

      {/* Stage: RESULT */}
      {stage === 'result' && result && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 320px) 1fr',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {/* Captured Photo Preview Card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
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
              {capturedPreview && (
                <img
                  src={capturedPreview}
                  alt="Captured face"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              <span
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  background: 'rgba(0,0,0,0.75)',
                  color: 'var(--color-accent)',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(6px)',
                }}
              >
                Captured Frame
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleScanAgain}
                id="camera-scan-again-btn"
                style={{ flex: 1, minWidth: '130px', height: '40px', fontSize: '13px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Scan Again
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleReset}
                id="camera-reset-btn"
                style={{ height: '40px', padding: '0 16px', fontSize: '13px' }}
              >
                Done
              </button>
            </div>
          </div>

          {/* Backend Result Card */}
          <div style={{ width: '100%' }}>
            <IdentifyResult result={result} />
          </div>
        </div>
      )}
    </div>
  )
}
