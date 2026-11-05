import { useState, type SubmitEvent } from 'react'
import { ErrorMessage } from '../../shared/components/AsyncStatus'
import { SelectField, TextField } from '../../shared/components/Field'
import { optionsFrom } from '../../shared/utils/options'
import type { SubmitState } from '../../shared/hooks/useSubmit'
import type { Person, PersonInput, Role, Specialty } from './api'
import { ROLE_LABELS, SPECIALTY_LABELS } from './labels'

interface Values {
  full_name: string
  role: string
  specialty: string
  email: string
  phone: string
  hourly_cost: string
}

function toValues(person?: Person): Values {
  return {
    full_name: person?.full_name ?? '',
    role: person?.role ?? '',
    specialty: person?.specialty ?? '',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    hourly_cost: person?.hourly_cost?.replace('.', ',') ?? '',
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Valores del formulario al contrato de la API. El coste admite coma decimal. */
function toPersonInput(values: Values): PersonInput {
  const cost = emptyToNull(values.hourly_cost)
  return {
    full_name: values.full_name,
    role: values.role as Role,
    specialty: (emptyToNull(values.specialty) as Specialty | null) ?? null,
    email: emptyToNull(values.email),
    phone: emptyToNull(values.phone),
    hourly_cost: cost === null ? null : cost.replace(',', '.'),
  }
}

interface PersonFormProps {
  person?: Person
  /** Rol fijo (alta inicial del primer responsable). */
  fixedRole?: Role
  submitLabel: string
  submitState: SubmitState
  onSubmit: (input: PersonInput) => void
  onCancel?: () => void
}

export function PersonForm({
  person,
  fixedRole,
  submitLabel,
  submitState,
  onSubmit,
  onCancel,
}: PersonFormProps) {
  const [values, setValues] = useState<Values>(() => ({
    ...toValues(person),
    ...(fixedRole ? { role: fixedRole } : {}),
  }))
  const errors = submitState.fieldErrors
  const set = (key: keyof Values) => (value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(toPersonInput(values))
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Nombre y apellidos"
        value={values.full_name}
        onChange={set('full_name')}
        error={errors.full_name}
        maxLength={160}
        required
      />
      <SelectField
        label="Rol"
        value={values.role}
        options={optionsFrom(ROLE_LABELS)}
        onChange={set('role')}
        error={errors.role}
        emptyLabel="Selecciona un rol"
        disabled={Boolean(fixedRole)}
        required
      />
      <SelectField
        label="Especialidad"
        value={values.specialty}
        options={optionsFrom(SPECIALTY_LABELS)}
        onChange={set('specialty')}
        error={errors.specialty}
        emptyLabel="Sin especialidad"
      />
      <TextField
        label="Email"
        type="email"
        value={values.email}
        onChange={set('email')}
        error={errors.email}
        maxLength={254}
      />
      <TextField
        label="Teléfono"
        type="tel"
        value={values.phone}
        onChange={set('phone')}
        error={errors.phone}
        maxLength={40}
      />
      <TextField
        label="Coste por hora (EUR)"
        value={values.hourly_cost}
        onChange={set('hourly_cost')}
        error={errors.hourly_cost}
        inputMode="decimal"
        hint="Opcional. Hasta dos decimales, p. ej. 35,50"
      />
      {submitState.error && <ErrorMessage message={submitState.error} />}
      <div className="actions">
        <button type="submit" className="button--primary" disabled={submitState.pending}>
          {submitState.pending ? 'Guardando…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={submitState.pending}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
