import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { useTimezone } from '../../app/SettingsContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { SelectField, TextField } from '../../shared/components/Field'
import { Icon } from '../../shared/components/Icon'
import { PageHeader } from '../../shared/components/PageHeader'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useUrlFilters } from '../../shared/hooks/useUrlFilters'
import { formatDateTime } from '../../shared/utils/datetime'
import { formatHours, orDash } from '../../shared/utils/format'
import { IncidentStatusBadge } from '../incidents/IncidentBadges'
import { FAILURE_TYPE_LABELS, SOLUTION_TYPE_LABELS } from '../incidents/labels'
import { MachineStatusBadge } from '../machines/MachineStatusBadge'
import { useMachineOptions } from '../machines/useMachineOptions'
import { listHistory, SEARCH_MAX_LENGTH, type HistoryItem } from './api'

const FILTERS = ['q', 'machine_id', 'symptom', 'root_cause'] as const
type TextFilter = 'q' | 'symptom' | 'root_cause'

/** Histórico de conocimiento: reparaciones documentadas para reutilizar en averías nuevas. */
export function HistoryPage() {
  const { filters, page, setFilters, setFilter, setPage, clear } = useUrlFilters(FILTERS)
  const query = { ...filters, page, page_size: DEFAULT_PAGE_SIZE }
  const { state, reload } = useAsyncData(JSON.stringify(query), (signal) =>
    listHistory(query, signal),
  )
  const machines = useMachineOptions({ includeRetired: true })
  // Los textos se aplican al enviar para no consultar en cada pulsación.
  const [draft, setDraft] = useState<Record<TextFilter, string>>({
    q: filters.q,
    symptom: filters.symptom,
    root_cause: filters.root_cause,
  })

  function edit(key: TextFilter) {
    return (value: string) => {
      setDraft((previous) => ({ ...previous, [key]: value }))
    }
  }

  function applyText(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters({
      q: draft.q.trim(),
      symptom: draft.symptom.trim(),
      root_cause: draft.root_cause.trim(),
    })
  }

  const filtered = FILTERS.some((key) => filters[key])

  return (
    <section aria-labelledby="history-title">
      <PageHeader
        titleId="history-title"
        title="Histórico de reparaciones"
        description="Antes de reparar, comprueba si el problema ya ocurrió y cómo se arregló. Averías resueltas y cerradas, de la más reciente a la más antigua; los filtros se combinan y no distinguen mayúsculas."
      />
      <form
        className="filters"
        role="search"
        aria-label="Buscar en el histórico"
        onSubmit={applyText}
      >
        <div className="form__full">
          <TextField
            label="Buscar"
            type="search"
            value={draft.q}
            onChange={edit('q')}
            maxLength={SEARCH_MAX_LENGTH}
            placeholder="Máquina, título, síntoma, causa o solución"
          />
        </div>
        <SelectField
          label="Máquina"
          value={filters.machine_id}
          options={machines.state.kind === 'ready' ? machines.state.data : []}
          onChange={(value) => {
            setFilter('machine_id', value)
          }}
          emptyLabel={machines.state.kind === 'loading' ? 'Cargando…' : 'Todas'}
        />
        <TextField
          label="Síntoma"
          type="search"
          value={draft.symptom}
          onChange={edit('symptom')}
          maxLength={SEARCH_MAX_LENGTH}
        />
        <TextField
          label="Causa raíz"
          type="search"
          value={draft.root_cause}
          onChange={edit('root_cause')}
          maxLength={SEARCH_MAX_LENGTH}
        />
        <div className="filters__actions">
          <button type="submit" className="button--primary">
            <Icon name="search" size={16} />
            Buscar
          </button>
          <button
            type="button"
            disabled={!filtered && !draft.q && !draft.symptom && !draft.root_cause}
            onClick={() => {
              setDraft({ q: '', symptom: '', root_cause: '' })
              clear()
            }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {state.kind === 'loading' && <Loading rows={6} />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty icon={filtered ? 'search' : 'book'}>
          {filtered
            ? 'Ninguna reparación documentada coincide con la búsqueda.'
            : 'Todavía no hay averías resueltas ni cerradas.'}
        </Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <div className="stack">
          <p className="result-count">
            {state.data.total}{' '}
            {state.data.total === 1 ? 'reparación documentada' : 'reparaciones documentadas'}
          </p>
          <ol className="history-list" aria-label="Resultados">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <HistoryCard item={item} />
              </li>
            ))}
          </ol>
          <Pagination
            page={state.data.page}
            pageSize={state.data.page_size}
            total={state.data.total}
            onChange={setPage}
          />
        </div>
      )}
    </section>
  )
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const timeZone = useTimezone()
  const titleId = `history-${String(item.id)}`
  return (
    <article className="card history-card" aria-labelledby={titleId}>
      <header className="history-card__header">
        <h2 id={titleId}>
          <Link to={`/averias/${String(item.id)}`}>
            <span className="history-card__number">{item.number}</span>
            {item.title}
          </Link>
        </h2>
        <IncidentStatusBadge status={item.status} />
      </header>
      <div className="history-card__meta">
        <span>
          <Icon name="factory" size={15} />
          <Link to={`/maquinas/${String(item.machine.id)}`}>{item.machine.code}</Link>{' '}
          {item.machine.name}
          {item.machine.status === 'de_baja' && (
            <>
              {' '}
              <MachineStatusBadge status={item.machine.status} />
            </>
          )}
        </span>
        <span>
          <Icon name="checkCircle" size={15} />
          {formatDateTime(item.resolved_at, timeZone)}
          {item.assigned_technician && ` por ${item.assigned_technician.full_name}`} ·{' '}
          {formatHours(item.worked_minutes)} de trabajo
        </span>
        <span>
          <Icon name="wrench" size={15} />
          {FAILURE_TYPE_LABELS[item.failure_type]}
          {item.solution_type &&
            ` · solución ${SOLUTION_TYPE_LABELS[item.solution_type].toLowerCase()}`}
        </span>
      </div>
      <dl className="history-card__body">
        <div>
          <dt>Síntoma</dt>
          <dd className="pre-line">{item.symptom}</dd>
        </div>
        <div>
          <dt>Causa raíz</dt>
          <dd className="pre-line">{item.root_cause}</dd>
        </div>
        <div className="history-card__solution">
          <dt>Solución aplicada</dt>
          <dd className="pre-line">{item.solution}</dd>
        </div>
        {item.replaced_parts?.trim() && (
          <div>
            <dt>Repuestos</dt>
            <dd className="pre-line">{orDash(item.replaced_parts)}</dd>
          </div>
        )}
      </dl>
    </article>
  )
}
