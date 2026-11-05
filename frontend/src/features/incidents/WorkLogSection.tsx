import { useState, type SubmitEvent } from 'react'
import { useTimezone } from '../../app/SettingsContext'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { TextAreaField, TextField } from '../../shared/components/Field'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { localDate } from '../../shared/utils/datetime'
import { formatDate, formatHours } from '../../shared/utils/format'
import { parseHours } from '../../shared/utils/hours'
import { addWorkLog, listWorkLogs, type IncidentDetail } from './api'

interface WorkLogSectionProps {
  incident: IncidentDetail
  canLog: boolean
  /** Tras imputar, la página muestra el aviso y recarga el detalle con las horas nuevas. */
  onLogged: (notice: string) => void
}

export function WorkLogSection({ incident, canLog, onLogged }: WorkLogSectionProps) {
  const timeZone = useTimezone()
  const { state, reload } = useAsyncData(
    `work-logs-${String(incident.id)}`,
    (signal) => listWorkLogs(incident.id, signal),
  )
  const today = localDate(new Date(), timeZone)
  const [values, setValues] = useState({ work_date: today, hours: '', description: '' })
  const [hoursError, setHoursError] = useState<string | null>(null)
  const submission = useSubmit()
  const errors = submission.state.fieldErrors
  const set = (key: keyof typeof values) => (value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = parseHours(values.hours)
    if (!parsed.ok) {
      setHoursError(parsed.error)
      return
    }
    setHoursError(null)
    void submission
      .submit(() =>
        addWorkLog(incident.id, {
          work_date: values.work_date,
          hours: parsed.value,
          description: values.description,
        }),
      )
      .then((log) => {
        if (!log) return
        setValues({ work_date: today, hours: '', description: '' })
        onLogged(`Imputadas ${formatHours(log.minutes)}`)
      })
  }

  return (
    <section aria-labelledby="work-logs-title">
      <h2 id="work-logs-title">Imputaciones</h2>
      {state.kind === 'loading' && <Loading />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty>Todavía no hay trabajo imputado.</Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Técnico</th>
              <th scope="col">Horas</th>
              <th scope="col">Trabajo realizado</th>
            </tr>
          </thead>
          <tbody>
            {state.data.items.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.work_date)}</td>
                <td>{log.technician.full_name}</td>
                <td>{formatHours(log.minutes)}</td>
                <td className="pre-line">{log.description}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total
              </th>
              <td>{formatHours(incident.worked_minutes)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      {canLog && (
        <form className="form form--grid card" onSubmit={handleSubmit} noValidate aria-label="Imputar trabajo">
          <TextField
            label="Fecha de trabajo"
            type="date"
            value={values.work_date}
            onChange={set('work_date')}
            error={errors.work_date}
            max={today}
            required
          />
          <TextField
            label="Horas"
            inputMode="decimal"
            value={values.hours}
            onChange={set('hours')}
            error={hoursError ?? errors.hours}
            hint="Tramos de 0,25 h, p. ej. 1,25"
            maxLength={10}
            required
          />
          <div className="form__full">
            <TextAreaField
              label="Trabajo realizado"
              value={values.description}
              onChange={set('description')}
              error={errors.description}
              maxLength={4000}
              rows={2}
              required
            />
          </div>
          {submission.state.error && <ErrorMessage message={submission.state.error} />}
          <div className="actions form__full">
            <button type="submit" className="button--primary" disabled={submission.state.pending}>
              {submission.state.pending ? 'Guardando…' : 'Imputar horas'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
