from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_session

router = APIRouter(tags=["salud"])


class HealthResponse(BaseModel):
    status: Literal["ok", "error"]
    database: Literal["ok", "error"]
    migration: str | None


@router.get("/health", response_model=HealthResponse)
def health(response: Response, session: Annotated[Session, Depends(get_session)]) -> HealthResponse:
    """Comprueba que la base de datos responde e informa de la revisión de Alembic aplicada.

    Devuelve 503 si la base no responde o si todavía no tiene migraciones aplicadas.
    """
    try:
        session.execute(text("SELECT 1"))
        has_version_table = session.execute(
            text("SELECT to_regclass('alembic_version') IS NOT NULL")
        ).scalar_one()
        revision = (
            session.execute(text("SELECT version_num FROM alembic_version")).scalar()
            if has_version_table
            else None
        )
    except SQLAlchemyError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="error", database="error", migration=None)
    if revision is None:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="error", database="ok", migration=None)
    return HealthResponse(status="ok", database="ok", migration=revision)
