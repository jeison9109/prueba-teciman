import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { ErrorMessage, Loading, SuccessMessage } from '../../shared/components/AsyncStatus'
import { ConfirmButton } from '../../shared/components/ConfirmButton'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { formatEuros, formatHours, orDash } from '../../shared/utils/format'
import { getPerson, retirePerson, updatePerson, type PersonDetail } from './api'
import { ROLE_LABELS, SPECIALTY_LABELS } from './labels'
import { PersonForm } from './PersonForm'

function retireBlockReason(person: PersonDetail): string | null {
  if (person.role === 'tecnico' && person.open_assignments > 0) {
    return `Tiene ${String(person.open_assignments)} avería(s) asignadas o en curso. Reasígnalas antes de darla de baja.`
  }
  return null
}

export function PersonDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const initialNotice = (location.state as { notice?: string } | null)?.notice ?? null
  const { isManager, refresh: refreshActors } = useActor()
  const { state, reload } = useAsyncData(`person-${String(id)}`, (signal) => getPerson(id, signal))
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(initialNotice)
  const edit = useSubmit()
  const action = useSubmit()

  function afterChange(message: string) {
    setNotice(message)
    reload()
    refreshActors()
  }

  if (state.kind === 'loading') return <Loading />
  if (state.kind === 'error') {
    return (
      <ErrorMessage
        message={state.status === 404 ? 'La persona no existe' : state.message}
        onRetry={state.status === 404 ? undefined : reload}
      />
    )
  }
  const person = state.data
  const blockReason = retireBlockReason(person)

  return (
    <section aria-labelledby="person-title">
      <p>
        <Link to="/personas">← Personas</Link>
      </p>
      <div className="page-header">
        <h1 id="person-title">{person.full_name}</h1>
        <span className={`badge badge--${person.active ? 'operativa' : 'de_baja'}`}>
          {person.active ? 'Activa' : 'De baja'}
        </span>
      </div>
      {notice && <SuccessMessage>{notice}</SuccessMessage>}

      {editing ? (
        <PersonForm
          person={person}
          submitLabel="Guardar cambios"
          submitState={edit.state}
          onCancel={() => {
            edit.reset()
            setEditing(false)
          }}
          onSubmit={(input) => {
            void edit.submit(() => updatePerson(person.id, input)).then((result) => {
              if (!result) return
              setEditing(false)
              afterChange('Cambios guardados')
            })
          }}
        />
      ) : (
        <>
          <dl className="details">
            <dt>Rol</dt>
            <dd>{ROLE_LABELS[person.role]}</dd>
            <dt>Especialidad</dt>
            <dd>{person.specialty ? SPECIALTY_LABELS[person.specialty] : '—'}</dd>
            <dt>Email</dt>
            <dd>{orDash(person.email)}</dd>
            <dt>Teléfono</dt>
            <dd>{orDash(person.phone)}</dd>
            <dt>Coste por hora</dt>
            <dd>{formatEuros(person.hourly_cost)}</dd>
            {person.role === 'tecnico' && (
              <>
                <dt>Averías a su cargo</dt>
                <dd>{person.open_assignments}</dd>
              </>
            )}
            <dt>Horas imputadas</dt>
            <dd>{formatHours(person.worked_minutes)}</dd>
          </dl>
          {action.state.error && <ErrorMessage message={action.state.error} />}
          {isManager && (
            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  setNotice(null)
                  setEditing(true)
                }}
              >
                Editar
              </button>
              {person.active ? (
                <ConfirmButton
                  label="Dar de baja"
                  confirmLabel="Confirmar baja"
                  question="La persona no podrá registrar ni recibir asignaciones."
                  danger
                  disabled={blockReason !== null}
                  pending={action.state.pending}
                  onConfirm={() => {
                    void action.submit(() => retirePerson(person.id)).then((result) => {
                      if (result !== undefined) afterChange('Persona dada de baja')
                    })
                  }}
                />
              ) : (
                <button
                  type="button"
                  disabled={action.state.pending}
                  onClick={() => {
                    void action
                      .submit(() => updatePerson(person.id, { active: true }))
                      .then((result) => {
                        if (result) afterChange('Persona reactivada')
                      })
                  }}
                >
                  Reactivar
                </button>
              )}
            </div>
          )}
          {isManager && person.active && blockReason && <p className="muted">{blockReason}</p>}
        </>
      )}
    </section>
  )
}
