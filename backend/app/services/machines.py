"""Casos de uso de máquinas. Gestión reservada al responsable; lectura abierta."""

from typing import Any

from sqlalchemy import ColumnElement, String, case, exists, func, literal, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.errors import ConflictError, FieldError, NotFoundError
from app.models import Incident, Machine, WorkLog
from app.models.enums import IncidentStatus, MachineAdminStatus, MachineStatus, Role
from app.schemas.common import Page, PageParams
from app.schemas.machine import MachineCreate, MachineDetail, MachineOut, MachineUpdate
from app.services.lifecycle import STOPPING_STATES
from app.services.locking import lock_machine, require_actor
from app.services.text import contains_pattern

MANAGERS = (Role.RESPONSABLE,)


def effective_status() -> ColumnElement[str]:
    """Estado efectivo derivado en SQL (spec.md, «Estado de la máquina»).

    La baja manda. Si no, cualquier avería activa con parada fuerza `en_averia`. En otro
    caso se muestra la condición administrativa guardada (operativa o fuera de servicio).
    """
    # Alias propio para que no se correlacione con una consulta exterior sobre averías.
    other = aliased(Incident)
    stopped = exists().where(
        other.machine_id == Machine.id,
        other.machine_stopped.is_(True),
        other.status.in_(STOPPING_STATES),
    )
    return case(
        (Machine.admin_status == MachineAdminStatus.DE_BAJA, literal(MachineStatus.DE_BAJA.value)),
        (stopped, literal(MachineStatus.EN_AVERIA.value)),
        else_=Machine.admin_status.cast(String),
    )


def _columns(machine: Machine) -> dict[str, Any]:
    return {column.key: getattr(machine, column.key) for column in Machine.__table__.columns}


def _not_found() -> NotFoundError:
    return NotFoundError("machine_not_found", "La máquina no existe")


def _code_taken() -> ConflictError:
    return ConflictError(
        "machine_code_taken",
        "Ya existe una máquina con ese código",
        [FieldError("code", "Ya existe una máquina con ese código")],
    )


def list_machines(
    session: Session,
    params: PageParams,
    *,
    status: MachineStatus | None = None,
    location: str | None = None,
    type_: str | None = None,
) -> Page[MachineOut]:
    status_expr = effective_status()
    filters: list[ColumnElement[bool]] = []
    if status is not None:
        filters.append(status_expr == status.value)
    if location:
        filters.append(Machine.location.ilike(contains_pattern(location), escape="\\"))
    if type_:
        filters.append(Machine.type.ilike(contains_pattern(type_), escape="\\"))

    total = session.scalar(select(func.count()).select_from(Machine).where(*filters)) or 0
    rows = session.execute(
        select(Machine, status_expr.label("status"))
        .where(*filters)
        .order_by(Machine.code, Machine.id)
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    items = [MachineOut.model_validate(_columns(row[0]) | {"status": row[1]}) for row in rows]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


def get_machine(session: Session, machine_id: int) -> MachineDetail:
    worked = (
        select(func.coalesce(func.sum(WorkLog.minutes), 0))
        .join(Incident, Incident.id == WorkLog.incident_id)
        .where(Incident.machine_id == Machine.id)
        .scalar_subquery()
    )
    open_incidents = (
        select(func.count())
        .select_from(Incident)
        .where(Incident.machine_id == Machine.id, Incident.status != IncidentStatus.CERRADA)
        .scalar_subquery()
    )
    row = session.execute(
        select(Machine, effective_status(), worked, open_incidents).where(Machine.id == machine_id)
    ).one_or_none()
    if row is None:
        raise _not_found()
    machine, status, worked_minutes, open_count = row
    return MachineDetail.model_validate(
        _columns(machine)
        | {"status": status, "worked_minutes": worked_minutes, "open_incidents": open_count}
    )


def _code_in_use(session: Session, code: str, exclude_id: int | None = None) -> bool:
    statement = select(Machine.id).where(Machine.code == code)
    if exclude_id is not None:
        statement = statement.where(Machine.id != exclude_id)
    return session.scalar(statement) is not None


def _commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        # Dos altas simultáneas con el mismo código: gana la primera en confirmar.
        if "uq_machines_code" in str(error.orig):
            raise _code_taken() from error
        raise


def create_machine(session: Session, actor_id: int | None, data: MachineCreate) -> MachineDetail:
    require_actor(session, actor_id, MANAGERS)
    if _code_in_use(session, data.code):
        raise _code_taken()
    machine = Machine(**data.model_dump())
    session.add(machine)
    _commit(session)
    return get_machine(session, machine.id)


def update_machine(
    session: Session, actor_id: int | None, machine_id: int, data: MachineUpdate
) -> MachineDetail:
    require_actor(session, actor_id, MANAGERS)
    machine = lock_machine(session, machine_id)
    if machine is None:
        raise _not_found()
    if machine.admin_status == MachineAdminStatus.DE_BAJA:
        raise ConflictError("machine_retired", "La máquina está de baja y solo admite consulta")

    changes = data.model_dump(exclude_unset=True)
    if "code" in changes and _code_in_use(session, changes["code"], exclude_id=machine.id):
        raise _code_taken()
    for key, value in changes.items():
        setattr(machine, key, value)
    _commit(session)
    return get_machine(session, machine.id)


def retire_machine(session: Session, actor_id: int | None, machine_id: int) -> None:
    """Baja lógica. Solo si todas sus averías están cerradas. Conserva el historial."""
    require_actor(session, actor_id, MANAGERS)
    machine = lock_machine(session, machine_id)
    if machine is None:
        raise _not_found()
    if machine.admin_status == MachineAdminStatus.DE_BAJA:
        session.rollback()
        return
    pending = session.scalar(
        select(func.count())
        .select_from(Incident)
        .where(Incident.machine_id == machine.id, Incident.status != IncidentStatus.CERRADA)
    )
    if pending:
        raise ConflictError(
            "machine_has_open_incidents",
            f"No se puede dar de baja: tiene {pending} avería(s) sin cerrar",
        )
    machine.admin_status = MachineAdminStatus.DE_BAJA
    session.commit()
