import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/** Esqueleto de carga: anticipa la forma del contenido y anuncia la carga a lectores de pantalla. */
export function Loading({ label = 'Cargando…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" className="skeleton" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton__row" aria-hidden="true" />
      ))}
    </div>
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
      <Icon name="alert" />
      <div className="alert__body">
        <p>{message}</p>
        {onRetry && (
          <button type="button" className="button--small" onClick={onRetry}>
            <Icon name="refresh" size={16} />
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

/** Estado vacío con icono y, si procede, la acción que lo resuelve. */
export function Empty({
  children,
  icon = 'inbox',
  action,
}: {
  children: ReactNode
  icon?: IconName
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Confirmación de una acción. Si recibe `onDismiss`, se puede cerrar. */
export function SuccessMessage({
  children,
  onDismiss,
}: {
  children: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div className="alert alert--ok">
      <Icon name="checkCircle" />
      <p role="status" className="alert__body">
        {children}
      </p>
      {onDismiss && (
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar aviso"
          onClick={onDismiss}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )
}
