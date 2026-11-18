import { Icon } from './Icon'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="muted">
        {first}–{last} de {total}
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="button--small"
          disabled={page <= 1}
          onClick={() => {
            onChange(page - 1)
          }}
        >
          <Icon name="back" size={16} />
          Anterior
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button
          type="button"
          className="button--small"
          disabled={page >= pages}
          onClick={() => {
            onChange(page + 1)
          }}
        >
          Siguiente
        </button>
      </div>
    </nav>
  )
}
