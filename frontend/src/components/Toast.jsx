/**
 * Toast — transient notification for network/unexpected errors.
 * Auto-dismisses after `duration` ms.
 */
export default function Toast({ message, type = 'error', onDismiss }) {
  return (
    <div
      className={`toast ${type}`}
      role="alert"
      aria-live="assertive"
      onClick={onDismiss}
      style={{ cursor: 'pointer' }}
      title="Click to dismiss"
    >
      {type === 'error' && (
        <svg
          width="16"
          height="16"
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
      )}
      <span>{message}</span>
    </div>
  )
}
