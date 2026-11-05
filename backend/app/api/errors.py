"""Formato común de error de la API.

Todas las respuestas de error tienen la forma::

    {"code": "machine_code_taken", "message": "Ya existe…", "fields": [{"field": "code", …}]}

`code` es estable y apto para programas, `message` está en español para la interfaz y
`fields` lista los campos afectados cuando aplica (vacía en otro caso).
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.errors import (
    ConflictError,
    DomainError,
    FieldError,
    ForbiddenError,
    InvalidDataError,
    NotFoundError,
)


class ErrorField(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    fields: list[ErrorField] = []


ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status.HTTP_403_FORBIDDEN: {"model": ErrorResponse, "description": "Actor sin permiso"},
    status.HTTP_404_NOT_FOUND: {"model": ErrorResponse, "description": "No encontrado"},
    status.HTTP_409_CONFLICT: {"model": ErrorResponse, "description": "Conflicto"},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {
        "model": ErrorResponse,
        "description": "Datos no válidos",
    },
}

_STATUS_BY_ERROR: dict[type[DomainError], int] = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ForbiddenError: status.HTTP_403_FORBIDDEN,
    ConflictError: status.HTTP_409_CONFLICT,
    InvalidDataError: status.HTTP_422_UNPROCESSABLE_CONTENT,
}

_HTTP_CODES = {
    status.HTTP_404_NOT_FOUND: ("not_found", "Recurso no encontrado"),
    status.HTTP_405_METHOD_NOT_ALLOWED: ("method_not_allowed", "Método no permitido"),
}


def _response(status_code: int, code: str, message: str, fields: list[FieldError]) -> JSONResponse:
    body = ErrorResponse(
        code=code,
        message=message,
        fields=[ErrorField(field=f.field, message=f.message) for f in fields],
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())


def _validation_message(error: dict[str, Any]) -> str:
    """Traduce los errores habituales de Pydantic; el resto conserva su mensaje."""
    kind = str(error.get("type", ""))
    ctx = error.get("ctx") or {}
    messages = {
        "missing": "Campo obligatorio",
        "string_too_short": "No puede estar vacío",
        "string_too_long": f"Máximo {ctx.get('max_length')} caracteres",
        "too_short": "No puede estar vacío",
        "too_long": f"Máximo {ctx.get('max_length')} caracteres",
        "string_pattern_mismatch": "Formato no válido",
        "enum": f"Valor no permitido. Opciones: {ctx.get('expected', '')}",
        "literal_error": f"Valor no permitido. Opciones: {ctx.get('expected', '')}",
        "extra_forbidden": "Campo no admitido",
        "greater_than_equal": f"Debe ser mayor o igual que {ctx.get('ge')}",
        "greater_than": f"Debe ser mayor que {ctx.get('gt')}",
        "less_than_equal": f"Debe ser menor o igual que {ctx.get('le')}",
        "decimal_max_places": f"Máximo {ctx.get('decimal_places')} decimales",
        "decimal_max_digits": "Número demasiado grande",
        "bool_parsing": "Debe ser verdadero o falso",
    }
    if kind in messages:
        return messages[kind]
    if kind.endswith("_parsing") or kind.endswith("_type"):
        return "Formato no válido"
    if kind == "value_error":
        return str(ctx.get("error", error.get("msg", "Valor no válido")))
    return str(error.get("msg", "Valor no válido"))


def _field_name(location: tuple[Any, ...]) -> str:
    parts = [str(part) for part in location if part not in {"body", "query", "path", "header"}]
    return ".".join(parts) or "body"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    def domain_error(_: Request, error: DomainError) -> JSONResponse:
        status_code = next(
            (code for cls, code in _STATUS_BY_ERROR.items() if isinstance(error, cls)),
            status.HTTP_400_BAD_REQUEST,
        )
        return _response(status_code, error.code, error.message, error.fields)

    @app.exception_handler(RequestValidationError)
    def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        fields = [
            FieldError(field=_field_name(tuple(item["loc"])), message=_validation_message(item))
            for item in error.errors()
        ]
        return _response(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "validation_error",
            "Hay datos no válidos",
            fields,
        )

    @app.exception_handler(IntegrityError)
    def integrity_error(_: Request, error: IntegrityError) -> JSONResponse:
        # Última barrera: los servicios validan antes, pero la base de datos decide.
        return _response(
            status.HTTP_409_CONFLICT,
            "integrity_conflict",
            "La operación entra en conflicto con los datos guardados",
            [],
        )

    @app.exception_handler(StarletteHTTPException)
    def http_error(_: Request, error: StarletteHTTPException) -> JSONResponse:
        code, message = _HTTP_CODES.get(error.status_code, ("http_error", str(error.detail)))
        return _response(error.status_code, code, message, [])
