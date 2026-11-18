import { useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { ErrorMessage, Loading, SuccessMessage } from '../../shared/components/AsyncStatus'
import { ConfirmButton } from '../../shared/components/ConfirmButton'
import { Icon } from '../../shared/components/Icon'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useSubmit } from '../../shared/hooks/useSubmit'
import { formatEuros, formatHours, orDash } from '../../shared/utils/format'
import { getPerson, retirePerson, updatePerson, type PersonDetail } from './api'
import { ROLE_LABELS, SPECIALTY_LABELS } from './labels'
import { PersonForm } from './PersonForm'
import { PersonStatusBadge } from './PersonStatusBadge'

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

  if (state.kind === 'loading') return <Loading rows={6} />
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

  const actionButtons = isManager && !editing && (
    <>
      <button
        type="button"
        onClick={() => {
          setNotice(null)
          setEditing(true)
        }}
      >
        <Icon name="edit" size={16} />
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
          <Icon name="refresh" size={16} />
          Reactivar
        </button>
      )}
    </>
  )

  return (
    <section aria-labelledby="person-title">
      <PageHeader
        titleId="person-title"
        back={{ to: '/personas', label: 'Personas' }}
        title={person.full_name}
        meta={
          <>
            <PersonStatusBadge active={person.active} />
            <span className="badge">{ROLE_LABELS[person.role]}</span>
          </>
        }
        actions={actionButtons}
      />
      {notice && (
        <SuccessMessage
          onDismiss={() => {
            setNotice(null)
          }}
        >
          {notice}
        </SuccessMessage>
      )}
      {action.state.error && <ErrorMessage message={action.state.error} />}
      {isManager && !editing && person.active && blockReason && (
        <p className="alert alert--info">
          <Icon name="info" />
          <span className="alert__body">{blockReason}</span>
        </p>
      )}

      {editing ? (
        <div className="card">
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
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat__label">
                <Icon name="clock" size={16} />
                Horas imputadas
              </span>
              <span className="stat__value">{formatHours(person.worked_minutes)}</span>
            </div>
            {person.role === 'tecnico' && (
              <div className={`stat${person.open_assignments > 0 ? ' stat--info' : ''}`}>
                <span className="stat__label">
                  <Icon name="wrench" size={16} />
                  Averías a su cargo
                </span>
                <span className="stat__value">{person.open_assignments}</span>
              </div>
            )}
          </div>
          <section className="card" aria-labelledby="person-data-title">
            <h2 id="person-data-title" className="card__title">
              <Icon name="user" />
              Datos de contacto y coste
            </h2>
            <dl className="details details--columns">
              <div>
                <dt>Rol</dt>
                <dd>{ROLE_LABELS[person.role]}</dd>
              </div>
              <div>
                <dt>Especialidad</dt>
                <dd>{person.specialty ? SPECIALTY_LABELS[person.specialty] : '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{orDash(person.email)}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{orDash(person.phone)}</dd>
              </div>
              <div>
                <dt>Coste por hora</dt>
                <dd>{formatEuros(person.hourly_cost)}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </section>
  )
}
