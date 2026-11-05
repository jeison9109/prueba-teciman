import { useState, type SubmitEvent } from 'react'
import { ErrorMessage } from '../../shared/components/AsyncStatus'
import { SelectField } from '../../shared/components/Field'
import { useTechnicianOptions } from '../people/useTechnicianOptions'

interface TechnicianPickerProps {
  label: string
  submitLabel: string
  pending: boolean
  error?: string | undefined
  /** Técnico actual, que no se ofrece al reasignar. */
  excludeId?: number | undefined
  onSubmit: (technicianId: number) => void
}

/** Selector de técnico activo para asignar o reasignar. */
export function TechnicianPicker({
  label,
  submitLabel,
  pending,
  error,
  excludeId,
  onSubmit,
}: TechnicianPickerProps) {
  const { state, reload } = useTechnicianOptions()
  const [value, setValue] = useState('')
  const options =
    state.kind === 'ready' ? state.data.filter((option) => option.value !== String(excludeId)) : []

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (value) onSubmit(Number(value))
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} noValidate>
      <SelectField
        label={label}
        value={value}
        options={options}
        onChange={setValue}
        error={error}
        emptyLabel={state.kind === 'loading' ? 'Cargando…' : 'Selecciona un técnico activo'}
        hint={state.kind === 'ready' && options.length === 0 ? 'No hay otros técnicos activos' : undefined}
        required
      />
      <button type="submit" className="button--primary" disabled={pending || !value}>
        {pending ? 'Enviando…' : submitLabel}
      </button>
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
    </form>
  )
}
