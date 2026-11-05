from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import ActorDep, SessionDep
from app.api.errors import ERROR_RESPONSES
from app.models.enums import IncidentStatus, Priority
from app.schemas.common import Page, PageParams
from app.schemas.incident import (
    AssignInput,
    IncidentCreate,
    IncidentDetail,
    IncidentOut,
    ResolveInput,
    WorkLogCreate,
    WorkLogOut,
)
from app.services import incidents as service

router = APIRouter(prefix="/incidents", tags=["averías"], responses=ERROR_RESPONSES)


@router.get("", response_model=Page[IncidentOut])
def list_incidents(
    session: SessionDep,
    page: Annotated[PageParams, Query()],
    machine_id: Annotated[int | None, Query(ge=1)] = None,
    status_: Annotated[IncidentStatus | None, Query(alias="status")] = None,
    priority: Priority | None = None,
) -> Page[IncidentOut]:
    """Bandeja de averías de todos los estados. Orden por detección descendente y por ID."""
    return service.list_incidents(
        session, page, machine_id=machine_id, status=status_, priority=priority
    )


@router.post("", response_model=IncidentDetail, status_code=status.HTTP_201_CREATED)
def create_incident(session: SessionDep, actor: ActorDep, data: IncidentCreate) -> IncidentDetail:
    """Registra una avería abierta. Cualquier persona activa en `X-Actor-Id`, que queda
    como reportante. El número `AV-<año>-<n>` lo genera el servidor."""
    return service.create_incident(session, actor, data)


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(session: SessionDep, incident_id: int) -> IncidentDetail:
    return service.get_incident(session, incident_id)


@router.post("/{incident_id}/assign", response_model=IncidentDetail)
def assign(
    session: SessionDep, actor: ActorDep, incident_id: int, data: AssignInput
) -> IncidentDetail:
    """Abierta → asignada. Responsable activo; el técnico debe estar activo."""
    return service.assign(session, actor, incident_id, data)


@router.post("/{incident_id}/reassign", response_model=IncidentDetail)
def reassign(
    session: SessionDep, actor: ActorDep, incident_id: int, data: AssignInput
) -> IncidentDetail:
    """Cambia el técnico de una avería asignada o en curso. Responsable activo."""
    return service.reassign(session, actor, incident_id, data)


@router.post("/{incident_id}/start", response_model=IncidentDetail)
def start(session: SessionDep, actor: ActorDep, incident_id: int) -> IncidentDetail:
    """Asignada → en curso. Solo el técnico asignado."""
    return service.start(session, actor, incident_id)


@router.post("/{incident_id}/resolve", response_model=IncidentDetail)
def resolve(
    session: SessionDep, actor: ActorDep, incident_id: int, data: ResolveInput
) -> IncidentDetail:
    """En curso → resuelta. Solo el técnico asignado. La hora la fija el servidor."""
    return service.resolve(session, actor, incident_id, data)


@router.post("/{incident_id}/close", response_model=IncidentDetail)
def close(session: SessionDep, actor: ActorDep, incident_id: int) -> IncidentDetail:
    """Resuelta → cerrada. Responsable activo, que queda como validador."""
    return service.close(session, actor, incident_id)


@router.get("/{incident_id}/work-logs", response_model=Page[WorkLogOut])
def list_work_logs(
    session: SessionDep, incident_id: int, page: Annotated[PageParams, Query()]
) -> Page[WorkLogOut]:
    """Imputaciones de la avería por fecha de trabajo y orden de registro."""
    return service.list_work_logs(session, incident_id, page)


@router.post(
    "/{incident_id}/work-logs", response_model=WorkLogOut, status_code=status.HTTP_201_CREATED
)
def add_work_log(
    session: SessionDep, actor: ActorDep, incident_id: int, data: WorkLogCreate
) -> WorkLogOut:
    """Imputa trabajo propio en una avería en curso. Cualquier técnico activo."""
    return service.add_work_log(session, actor, incident_id, data)
