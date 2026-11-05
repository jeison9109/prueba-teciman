import { useId, type ReactNode } from 'react'
import type { Option } from '../utils/options'

interface FieldShellProps {
  label: string
  error?: string | undefined
  hint?: string | undefined
  required?: boolean | undefined
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => ReactNode
}

/** Etiqueta, control, ayuda y error asociados por `id` para lectores de pantalla. */
function FieldShell({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && (
        <small id={hintId} className="muted">
          {hint}
        </small>
      )}
      {error && (
        <small id={errorId} className="field__error">
          {error}
        </small>
      )}
    </div>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
  hint?: string
  required?: boolean
  type?: 'text' | 'email' | 'tel' | 'date' | 'datetime-local' | 'search'
  inputMode?: 'decimal' | 'text'
  maxLength?: number
  max?: string
  min?: string
  disabled?: boolean
  placeholder?: string
}

export function TextField({ label, error, hint, required, onChange, ...input }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(aria) => (
        <input
          {...aria}
          {...input}
          type={input.type ?? 'text'}
          required={required}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
      )}
    </FieldShell>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  options: readonly Option[]
  onChange: (value: string) => void
  error?: string | undefined
  hint?: string | undefined
  required?: boolean
  disabled?: boolean
  /** Texto de la opción vacía; si se omite no hay opción vacía. */
  emptyLabel?: string
}

export function SelectField({
  label,
  options,
  onChange,
  error,
  hint,
  required,
  emptyLabel,
  ...select
}: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(aria) => (
        <select
          {...aria}
          {...select}
          required={required}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        >
          {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
  hint?: string
  required?: boolean
  maxLength?: number
  rows?: number
  disabled?: boolean
}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  onChange,
  rows = 3,
  ...textarea
}: TextAreaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(aria) => (
        <textarea
          {...aria}
          {...textarea}
          rows={rows}
          required={required}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
      )}
    </FieldShell>
  )
}
