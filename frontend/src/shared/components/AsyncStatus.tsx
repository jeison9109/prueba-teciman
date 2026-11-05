import type { ReactNode } from 'react'

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p role="status" className="muted">
      {label}
    </p>
  )
}

export function ErrorMessage({
  message,
  onRetry,
}: {
  message: string
  onRetry?: (() => void) | undefined
}) {
  return (
    <div role="alert" className="alert alert--error">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="alert alert--ok">
      {children}
    </p>
  )
}
