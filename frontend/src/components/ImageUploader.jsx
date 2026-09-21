import { useRef, useState } from 'react'

const MAX_IMAGES = 3

/**
 * ImageUploader — reusable multi-image picker with drag-drop,
 * click-to-browse, image previews, and per-image remove buttons.
 *
 * Props:
 *   images   : File[]           — current selected files
 *   previews : string[]         — matching object URL strings
 *   onChange : (files, prevs) => void  — called when selection changes
 *   disabled : boolean
 */
export default function ImageUploader({ images, previews, onChange, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = (newFiles) => {
    const combined = [...images]
    const combinedPrevs = [...previews]

    for (const file of newFiles) {
      if (combined.length >= MAX_IMAGES) break
      if (!file.type.startsWith('image/')) continue
      combined.push(file)
      combinedPrevs.push(URL.createObjectURL(file))
    }

    onChange(combined, combinedPrevs)
  }

  const removeImage = (index) => {
    URL.revokeObjectURL(previews[index])
    const newImages = images.filter((_, i) => i !== index)
    const newPrevs = previews.filter((_, i) => i !== index)
    onChange(newImages, newPrevs)
  }

  const handleFiles = (e) => {
    addFiles(Array.from(e.target.files || []))
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const canAddMore = images.length < MAX_IMAGES

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Preview grid — shown when images are selected */}
      {images.length > 0 && (
        <div className="preview-grid">
          {previews.map((src, i) => (
            <div className="preview-item" key={i}>
              <img src={src} alt={`Preview ${i + 1}`} />
              {!disabled && (
                <button
                  className="preview-remove"
                  onClick={() => removeImage(i)}
                  aria-label={`Remove image ${i + 1}`}
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — shown when fewer than MAX_IMAGES selected */}
      {canAddMore && (
        <div
          className={`drop-zone${dragging ? ' dragging' : ''}`}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Add up to ${MAX_IMAGES - images.length} more image${MAX_IMAGES - images.length !== 1 ? 's' : ''}`}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dragging ? 'var(--color-accent)' : 'var(--color-text-muted)'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'stroke 0.2s' }}
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: dragging ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                transition: 'color 0.2s',
              }}
            >
              {images.length === 0
                ? 'Click or drag images here'
                : `Add ${MAX_IMAGES - images.length} more image${MAX_IMAGES - images.length !== 1 ? 's' : ''}`}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
              }}
            >
              Up to {MAX_IMAGES} images total — one clear face per image
            </p>
          </div>
        </div>
      )}

      {/* When max images reached */}
      {!canAddMore && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            background: 'rgba(245,200,66,0.06)',
            border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: '10px',
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontSize: '13.5px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--color-accent)',
                flexShrink: 0,
              }}
            />
            <span>
              <strong style={{ color: 'var(--color-text-primary)' }}>3 of 3 images selected</strong> (maximum limit reached).
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Click ✕ on an image above to replace it
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFiles}
        disabled={disabled}
        id="image-file-input"
      />
    </div>
  )
}
