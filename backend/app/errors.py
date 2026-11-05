"""Errores de dominio. Los servicios los lanzan y `app.api.errors` los traduce a HTTP."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FieldError:
    field: str
    message: str


@dataclass
class DomainError(Exception):
    """Error con código estable para la API y mensaje en español para la interfaz."""

    code: str
    message: str
    fields: list[FieldError] = field(default_factory=list)

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"


class NotFoundError(DomainError):
    """Recurso de la ruta inexistente (404)."""


class ForbiddenError(DomainError):
    """Actor ausente, inactivo o sin permiso (403)."""


class ConflictError(DomainError):
    """Conflicto de estado o duplicado (409)."""


class InvalidDataError(DomainError):
    """Datos válidos en forma pero no admitidos por una regla de negocio (422)."""
