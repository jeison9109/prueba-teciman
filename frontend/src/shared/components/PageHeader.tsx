import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from './Icon'

interface PageHeaderProps {
  /** Id del título, para `aria-labelledby` de la sección. */
  titleId: string
  title: ReactNode
  /** Texto pequeño sobre el título, p. ej. el número de avería o el código de máquina. */
  eyebrow?: ReactNode
  description?: ReactNode
  /** Enlace de vuelta al listado. */
  back?: { to: string; label: string }
  /** Insignias junto al título. */
  meta?: ReactNode
  actions?: ReactNode
}

/** Cabecera común de página: migas, título, descripción y acciones principales. */
export function PageHeader({
  titleId,
  title,
  eyebrow,
  description,
  back,
  meta,
  actions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      {back && (
        <Link className="back-link" to={back.to}>
          <Icon name="back" size={16} />
          {back.label}
        </Link>
      )}
      <div className="page-header__row">
        <div className="page-header__text">
          <h1 id={titleId}>
            {eyebrow && (
              <span className="page-header__eyebrow">
                {eyebrow}
                <span className="visually-hidden"> · </span>
              </span>
            )}
            {title}
          </h1>
          {meta && <div className="badges">{meta}</div>}
          {description && <p className="page-header__description">{description}</p>}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
    </header>
  )
}
