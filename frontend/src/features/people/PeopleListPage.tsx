import { Link } from 'react-router'
import { useActor } from '../../app/ActorContext'
import { DEFAULT_PAGE_SIZE } from '../../shared/api/types'
import { Empty, ErrorMessage, Loading } from '../../shared/components/AsyncStatus'
import { SelectField } from '../../shared/components/Field'
import { optionsFrom } from '../../shared/utils/options'
import { Pagination } from '../../shared/components/Pagination'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useUrlFilters } from '../../shared/hooks/useUrlFilters'
import { orDash } from '../../shared/utils/format'
import { listPeople } from './api'
import { ROLE_LABELS, SPECIALTY_LABELS } from './labels'

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

  return (
    <section aria-labelledby="people-title">
      <div className="page-header">
        <h1 id="people-title">Personas</h1>
        {isManager && (
          <Link className="button button--primary" to="/personas/nueva">
            Nueva persona
          </Link>
        )}
      </div>
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
        <button type="button" onClick={clear}>
          Limpiar filtros
        </button>
      </form>

      {state.kind === 'loading' && <Loading />}
      {state.kind === 'error' && <ErrorMessage message={state.message} onRetry={reload} />}
      {state.kind === 'ready' && state.data.items.length === 0 && (
        <Empty>No hay personas con estos filtros.</Empty>
      )}
      {state.kind === 'ready' && state.data.items.length > 0 && (
        <>
          <p className="muted">{state.data.total} persona(s)</p>
          <table>
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
                  <td>
                    <Link to={`/personas/${String(person.id)}`}>{person.full_name}</Link>
                  </td>
                  <td>{ROLE_LABELS[person.role]}</td>
                  <td>{person.specialty ? SPECIALTY_LABELS[person.specialty] : '—'}</td>
                  <td>{orDash(person.email)}</td>
                  <td>
                    <span className={`badge badge--${person.active ? 'operativa' : 'de_baja'}`}>
                      {person.active ? 'Activa' : 'De baja'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={state.data.page}
            pageSize={state.data.page_size}
            total={state.data.total}
            onChange={setPage}
          />
        </>
      )}
    </section>
  )
}
