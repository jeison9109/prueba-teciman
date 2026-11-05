from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import ActorDep, SessionDep
from app.api.errors import ERROR_RESPONSES
from app.models.enums import MachineStatus
from app.schemas.common import Page, PageParams
from app.schemas.machine import MachineCreate, MachineDetail, MachineOut, MachineUpdate
from app.services import machines as service

router = APIRouter(prefix="/machines", tags=["máquinas"], responses=ERROR_RESPONSES)


@router.get("", response_model=Page[MachineOut])
def list_machines(
    session: SessionDep,
    page: Annotated[PageParams, Query()],
    status_: Annotated[
        MachineStatus | None, Query(alias="status", description="Estado efectivo")
    ] = None,
    location: Annotated[
        str | None, Query(max_length=120, description="Coincidencia parcial")
    ] = None,
    type_: Annotated[
        str | None, Query(alias="type", max_length=80, description="Coincidencia parcial")
    ] = None,
) -> Page[MachineOut]:
    """Lista máquinas, incluidas las de baja. Orden por código y desempate por ID."""
    return service.list_machines(session, page, status=status_, location=location, type_=type_)


@router.post("", response_model=MachineDetail, status_code=status.HTTP_201_CREATED)
def create_machine(session: SessionDep, actor: ActorDep, data: MachineCreate) -> MachineDetail:
    """Alta de máquina. Requiere un responsable activo en `X-Actor-Id`."""
    return service.create_machine(session, actor, data)


@router.get("/{machine_id}", response_model=MachineDetail)
def get_machine(session: SessionDep, machine_id: int) -> MachineDetail:
    return service.get_machine(session, machine_id)


@router.patch("/{machine_id}", response_model=MachineDetail)
def update_machine(
    session: SessionDep, actor: ActorDep, machine_id: int, data: MachineUpdate
) -> MachineDetail:
    """Cambio parcial. Durante una parada se puede cambiar la condición administrativa;
    el estado efectivo sigue siendo `en_averia` mientras dure."""
    return service.update_machine(session, actor, machine_id, data)


@router.delete("/{machine_id}", status_code=status.HTTP_204_NO_CONTENT)
def retire_machine(session: SessionDep, actor: ActorDep, machine_id: int) -> Response:
    """Baja lógica. Solo si todas sus averías están cerradas."""
    service.retire_machine(session, actor, machine_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
