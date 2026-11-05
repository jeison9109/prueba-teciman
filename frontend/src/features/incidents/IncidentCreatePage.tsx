import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { useTimezone } from '../../app/SettingsContext'
import { ErrorMessage } from '../../shared/components/AsyncStatus'
import { SelectField, TextAreaField, TextField } from '../../shared/components/Field'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { localDateTimeInput } from '../../shared/utils/datetime'
import { optionsFrom } from '../../shared/utils/options'
import { useMachineOptions } from '../machines/useMachineOptions'
import { createIncident, type FailureType, type IncidentInput, type Priority } from './api'
import { FAILURE_TYPE_LABELS, PRIORITY_LABELS } from './labels'

const STOPPED_OPTIONS = [
  { value: 'true', label: 'Sí, la máquina está parada' },
  { value: 'false', label: 'No, sigue funcionando' },
]

interface Values {
  machine_id: string
  detected_at: string
  title: string
  symptom: string
  failure_type: string
  priority: string
  machine_stopped: string
}

export function IncidentCreatePage() {
  const { actor } = useActor()
  const timeZone = useTimezone()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const machines = useMachineOptions({ includeRetired: false })
  const { state, submit } = useSubmit()
  const [values, setValues] = useState<Values>(() => ({
    machine_id: params.get('machine_id') ?? '',
    detected_at: localDateTimeInput(new Date(), timeZone),
    title: '',
    symptom: '',
    failure_type: '',
    priority: '',
    machine_stopped: '',
  }))
  const errors = state.fieldErrors
  const set = (key: keyof Values) => (value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  if (!actor) {
    return (
      <ErrorMessage message="Elige una persona activa en la cabecera para registrar una avería." />
    )
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    // Los desplegables sin elegir se omiten: la API los marca como obligatorios junto al campo.
    const input: IncidentInput = {
      detected_at: values.detected_at,
      title: values.title,
      symptom: values.symptom,
      ...(values.machine_id && { machine_id: Number(values.machine_id) }),
      ...(values.failure_type && { failure_type: values.failure_type as FailureType }),
      ...(values.priority && { priority: values.priority as Priority }),
      ...(values.machine_stopped && { machine_stopped: values.machine_stopped === 'true' }),
    }
    void submit(() => createIncident(input)).then((incident) => {
      if (!incident) return
      void navigate(`/averias/${String(incident.id)}`, {
        state: { notice: `Avería ${incident.number} registrada` },
      })
    })
  }

  return (
    <section aria-labelledby="incident-create-title">
      <p>
        <Link to="/averias">← Averías</Link>
      </p>
      <h1 id="incident-create-title">Registrar avería</h1>
      <p className="muted">
        Quedará registrada a nombre de {actor.full_name}. Horas en la zona {timeZone}.
      </p>
      {machines.state.kind === 'error' && (
        <ErrorMessage message={machines.state.message} onRetry={machines.reload} />
      )}
      <form className="form form--grid" onSubmit={handleSubmit} noValidate>
        <SelectField
          label="Máquina"
          value={values.machine_id}
          options={machines.state.kind === 'ready' ? machines.state.data : []}
          onChange={set('machine_id')}
          error={errors.machine_id}
          emptyLabel={machines.state.kind === 'loading' ? 'Cargando…' : 'Selecciona la máquina'}
          hint="Las máquinas de baja no admiten nuevas averías"
          required
        />
        <TextField
          label="Detección"
          type="datetime-local"
          value={values.detected_at}
          onChange={set('detected_at')}
          error={errors.detected_at}
          max={localDateTimeInput(new Date(), timeZone)}
          required
        />
        <TextField
          label="Título"
          value={values.title}
          onChange={set('title')}
          error={errors.title}
          maxLength={160}
          required
        />
        <SelectField
          label="¿Ha parado la máquina?"
          value={values.machine_stopped}
          options={STOPPED_OPTIONS}
          onChange={set('machine_stopped')}
          error={errors.machine_stopped}
          emptyLabel="Indica si hay parada"
          required
        />
        <SelectField
          label="Tipo de fallo"
          value={values.failure_type}
          options={optionsFrom(FAILURE_TYPE_LABELS)}
          onChange={set('failure_type')}
          error={errors.failure_type}
          emptyLabel="Selecciona el tipo"
          required
        />
        <SelectField
          label="Prioridad"
          value={values.priority}
          options={optionsFrom(PRIORITY_LABELS)}
          onChange={set('priority')}
          error={errors.priority}
          emptyLabel="Selecciona la prioridad"
          required
        />
        <div className="form__full">
          <TextAreaField
            label="Síntoma"
            value={values.symptom}
            onChange={set('symptom')}
            error={errors.symptom}
            maxLength={4000}
            hint="Qué se observa: ruidos, fugas, alarmas, mensajes…"
            required
          />
        </div>
        {state.error && <ErrorMessage message={state.error} />}
        <div className="actions form__full">
          <button type="submit" className="button--primary" disabled={state.pending}>
            {state.pending ? 'Registrando…' : 'Registrar avería'}
          </button>
          <Link className="button" to="/averias">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  )
}
