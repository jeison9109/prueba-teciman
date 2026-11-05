import { useState } from 'react'

interface ConfirmButtonProps {
  label: string
  confirmLabel: string
  question: string
  onConfirm: () => void
  pending?: boolean
  disabled?: boolean
  danger?: boolean
}

/** Botón con confirmación en línea, sin diálogos del navegador. */
export function ConfirmButton({
  label,
  confirmLabel,
  question,
  onConfirm,
  pending = false,
  disabled = false,
  danger = false,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false)
  const className = danger ? 'button--danger' : undefined
  if (!asking) {
    return (
      <button
        type="button"
        className={className}
        disabled={disabled || pending}
        onClick={() => {
          setAsking(true)
        }}
      >
        {label}
      </button>
    )
  }
  return (
    <span className="confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        {pending ? 'Enviando…' : confirmLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setAsking(false)
        }}
      >
        Cancelar
      </button>
    </span>
  )
}
