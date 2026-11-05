import { useState, type SubmitEvent } from 'react'
import { ErrorMessage } from '../../shared/components/AsyncStatus'
import { SelectField, TextField } from '../../shared/components/Field'
import { optionsFrom } from '../../shared/utils/options'
import type { SubmitState } from '../../shared/hooks/useSubmit'
import type { Criticality, EditableAdminStatus, Machine, MachineInput } from './api'
import { ADMIN_STATUS_LABELS, CRITICALITY_LABELS } from './labels'

interface Values {
  code: string
  name: string
  type: string
  manufacturer: string
  model: string
  serial_number: string
  location: string
  commissioning_date: string
  criticality: string
  admin_status: string
}

function toValues(machine?: Machine): Values {
  return {
    code: machine?.code ?? '',
    name: machine?.name ?? '',
    type: machine?.type ?? '',
    manufacturer: machine?.manufacturer ?? '',
    model: machine?.model ?? '',
    serial_number: machine?.serial_number ?? '',
    location: machine?.location ?? '',
    commissioning_date: machine?.commissioning_date ?? '',
    criticality: machine?.criticality ?? '',
    admin_status:
      machine && machine.admin_status !== 'de_baja' ? machine.admin_status : 'operativa',
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toMachineInput(values: Values): MachineInput {
  return {
    code: values.code,
    name: values.name,
    type: values.type,
    manufacturer: emptyToNull(values.manufacturer),
    model: emptyToNull(values.model),
    serial_number: emptyToNull(values.serial_number),
    location: values.location,
    commissioning_date: emptyToNull(values.commissioning_date),
    criticality: values.criticality as Criticality,
    admin_status: values.admin_status as EditableAdminStatus,
  }
}

interface MachineFormProps {
  machine?: Machine
  submitLabel: string
  submitState: SubmitState
  onSubmit: (input: MachineInput) => void
  onCancel: () => void
}

export function MachineForm({
  machine,
  submitLabel,
  submitState,
  onSubmit,
  onCancel,
}: MachineFormProps) {
  const [values, setValues] = useState<Values>(() => toValues(machine))
  const errors = submitState.fieldErrors
  const set = (key: keyof Values) => (value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(toMachineInput(values))
  }

  return (
    <form className="form form--grid" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Código"
        value={values.code}
        onChange={set('code')}
        error={errors.code}
        hint="Único. Se guarda en mayúsculas"
        maxLength={40}
        required
      />
      <TextField
        label="Nombre"
        value={values.name}
        onChange={set('name')}
        error={errors.name}
        maxLength={120}
        required
      />
      <TextField
        label="Tipo o familia"
        value={values.type}
        onChange={set('type')}
        error={errors.type}
        maxLength={80}
        placeholder="Prensa, CNC, compresor…"
        required
      />
      <TextField
        label="Ubicación"
        value={values.location}
        onChange={set('location')}
        error={errors.location}
        maxLength={120}
        required
      />
      <SelectField
        label="Criticidad"
        value={values.criticality}
        options={optionsFrom(CRITICALITY_LABELS)}
        onChange={set('criticality')}
        error={errors.criticality}
        emptyLabel="Selecciona la criticidad"
        required
      />
      <SelectField
        label="Condición administrativa"
        value={values.admin_status}
        options={optionsFrom(ADMIN_STATUS_LABELS)}
        onChange={set('admin_status')}
        error={errors.admin_status}
        hint="Durante una parada la máquina se muestra en avería"
        required
      />
      <TextField
        label="Fabricante"
        value={values.manufacturer}
        onChange={set('manufacturer')}
        error={errors.manufacturer}
        maxLength={120}
      />
      <TextField
        label="Modelo"
        value={values.model}
        onChange={set('model')}
        error={errors.model}
        maxLength={120}
      />
      <TextField
        label="Número de serie"
        value={values.serial_number}
        onChange={set('serial_number')}
        error={errors.serial_number}
        maxLength={80}
      />
      <TextField
        label="Puesta en marcha"
        type="date"
        value={values.commissioning_date}
        onChange={set('commissioning_date')}
        error={errors.commissioning_date}
      />
      {submitState.error && <ErrorMessage message={submitState.error} />}
      <div className="actions form__full">
        <button type="submit" className="button--primary" disabled={submitState.pending}>
          {submitState.pending ? 'Guardando…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={submitState.pending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
