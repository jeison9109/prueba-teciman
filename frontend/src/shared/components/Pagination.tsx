interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="Paginación">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => {
          onChange(page - 1)
        }}
      >
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => {
          onChange(page + 1)
        }}
      >
        Siguiente
      </button>
    </nav>
  )
}
