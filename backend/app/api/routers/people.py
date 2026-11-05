from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import ActorDep, SessionDep
from app.api.errors import ERROR_RESPONSES
from app.models.enums import Role
from app.schemas.common import Page, PageParams
from app.schemas.person import PersonCreate, PersonDetail, PersonOut, PersonUpdate
from app.services import people as service

router = APIRouter(prefix="/people", tags=["personas"], responses=ERROR_RESPONSES)


@router.get("", response_model=Page[PersonOut])
def list_people(
    session: SessionDep,
    page: Annotated[PageParams, Query()],
    role: Role | None = None,
    active: bool | None = None,
) -> Page[PersonOut]:
    """Lista personas, incluidas las inactivas salvo que se filtre. Orden por nombre e ID."""
    return service.list_people(session, page, role=role, active=active)


@router.post("", response_model=PersonDetail, status_code=status.HTTP_201_CREATED)
def create_person(session: SessionDep, actor: ActorDep, data: PersonCreate) -> PersonDetail:
    """Alta de persona. Requiere un responsable activo en `X-Actor-Id`.

    Excepción de arranque: con la tabla vacía se admite sin actor un primer responsable.
    """
    return service.create_person(session, actor, data)


@router.get("/{person_id}", response_model=PersonDetail)
def get_person(session: SessionDep, person_id: int) -> PersonDetail:
    return service.get_person(session, person_id)


@router.patch("/{person_id}", response_model=PersonDetail)
def update_person(
    session: SessionDep, actor: ActorDep, person_id: int, data: PersonUpdate
) -> PersonDetail:
    return service.update_person(session, actor, person_id, data)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def retire_person(session: SessionDep, actor: ActorDep, person_id: int) -> Response:
    """Baja lógica. Bloqueada para técnicos con averías a su cargo y para el último
    responsable activo."""
    service.retire_person(session, actor, person_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
