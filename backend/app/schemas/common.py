"""Tipos y contratos compartidos por los esquemas de la API."""

from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


# Uso: `Annotated[str, Trimmed, Field(min_length=1, max_length=120)]` para texto obligatorio
# y `Annotated[Annotated[str, Field(max_length=120)] | None, BlankToNone]` para opcional.
Trimmed = BeforeValidator(_strip)
BlankToNone = BeforeValidator(_blank_to_none)


class InputModel(BaseModel):
    """Entrada de la API: rechaza campos desconocidos para no ignorar errores de escritura."""

    model_config = ConfigDict(extra="forbid")


def reject_null(value: object) -> object:
    """Validador `before` para PATCH: un campo obligatorio puede omitirse, pero no vaciarse."""
    if value is None:
        raise ValueError("Campo obligatorio")
    return value


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams(BaseModel):
    page: Annotated[int, Field(ge=1)] = 1
    page_size: Annotated[int, Field(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
