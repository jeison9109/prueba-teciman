"""Dependencias comunes de los routers."""

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.errors import ForbiddenError

ACTOR_HEADER = "X-Actor-Id"

SessionDep = Annotated[Session, Depends(get_session)]


def actor_id(
    x_actor_id: Annotated[
        str | None,
        Header(
            alias=ACTOR_HEADER,
            description="ID de la persona activa que realiza la escritura (identidad simulada)",
        ),
    ] = None,
) -> int | None:
    """Lee el actor simulado. Su existencia, vigencia y rol los valida el servicio."""
    if x_actor_id is None or not x_actor_id.strip():
        return None
    try:
        value = int(x_actor_id)
    except ValueError as error:
        raise ForbiddenError("actor_invalid", "El identificador de actor no es válido") from error
    if value < 1:
        raise ForbiddenError("actor_invalid", "El identificador de actor no es válido")
    return value


ActorDep = Annotated[int | None, Depends(actor_id)]
