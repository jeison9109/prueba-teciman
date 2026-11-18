import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { SelectField } from '../../shared/components/Field'
import { optionsFrom } from '../../shared/utils/options'
import { Icon } from '../../shared/components/Icon'
import { PageHeader } from '../../shared/components/PageHeader'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useUrlFilters } from '../../shared/hooks/useUrlFilters'
import { initials, orDash } from '../../shared/utils/format'
import { listPeople } from './api'
import { ROLE_LABELS, SPECIALTY_LABELS } from './labels'
import { PersonStatusBadge } from './PersonStatusBadge'

const FILTERS = ['role', 'active'] as const
const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Activas' },
  { value: 'false', label: 'De baja' },
]

export function PeopleListPage() {
  const { isManager } = useActor()
  const { filters, page, setFilter, setPage, clear } = useUrlFilters(FILTERS)
  const query = { ...filters, page, page_size: DEFAULT_PAGE_SIZE }
  const { state, reload } = useAsyncData(JSON.stringify(query), (signal) =>
    listPeople(query, signal),
  )

  const filtered = FILTERS.some((key) => filters[key])

  return (
    <section aria-labelledby="people-title">
      <PageHeader
        titleId="people-title"
        title="Personas"
        description="Quién reporta, resuelve y valida las averías. Solo los técnicos activos pueden recibir asignaciones."
        actions={
          isManager && (
            <Link className="button button--primary" to="/personas/nueva">
              <Icon name="plus" />
              Nueva persona
            </Link>
          )
        }
      />
      <form className="filters" role="search" aria-label="Filtrar personas">
        <SelectField
          label="Rol"
          value={filters.role}
          options={optionsFrom(ROLE_LABELS)}
          onChange={(value) => {
            setFilter('role', value)
          }}
          emptyLabel="Todos"
        />
        <SelectField
          label="Vigencia"
          value={filters.active}
          options={ACTIVE_OPTIONS}
          onChange={(value) => {
            setFilter('active', value)
          }}
          emptyLabel="Todas"
        />
        <div className="filters__actions">
          <button type="button" onClick={clear} disabled={!filtered}>
            Limpiar filtros
          </button>
        </div>
      </form>

      {state.kind === 'loading' && <Loading rows={6} />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty icon={filtered ? 'search' : 'users'}>
          {filtered ? 'No hay personas con estos filtros.' : 'Todavía no hay personas registradas.'}
        </Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <div className="stack">
          <p className="result-count">
            {state.data.total} {state.data.total === 1 ? 'persona' : 'personas'}
          </p>
          <div className="table-wrap">
            <table className="table--stack">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Especialidad</th>
                  <th scope="col">Email</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((person) => (
                  <tr key={person.id} className={person.active ? undefined : 'row--retired'}>
                    <td className="cell--wide" data-label="Nombre">
                      <span className="cell-person">
                        <span className="avatar avatar--light" aria-hidden="true">
                          {initials(person.full_name)}
                        </span>
                        <Link className="cell-title" to={`/personas/${String(person.id)}`}>
                          {person.full_name}
                        </Link>
                      </span>
                    </td>
                    <td data-label="Rol">{ROLE_LABELS[person.role]}</td>
                    <td data-label="Especialidad">
                      {person.specialty ? SPECIALTY_LABELS[person.specialty] : '—'}
                    </td>
                    <td className="cell--wide" data-label="Email">
                      {orDash(person.email)}
                    </td>
                    <td data-label="Estado">
                      <span>
                        <PersonStatusBadge active={person.active} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
