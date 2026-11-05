"""Casos de uso de personas. Gestión reservada al responsable; lectura abierta."""

from typing import Any

from sqlalchemy import ColumnElement, func, select, text
from sqlalchemy.orm import Session

from app.errors import ConflictError, InvalidDataError, NotFoundError
from app.models import Incident, Person, WorkLog
from app.models.enums import Role
from app.schemas.common import Page, PageParams
from app.schemas.person import PersonCreate, PersonDetail, PersonOut, PersonUpdate
from app.services.lifecycle import ASSIGNED_STATES
from app.services.locking import check_actor, lock_people, require_actor

MANAGERS = (Role.RESPONSABLE,)


def _not_found() -> NotFoundError:
    return NotFoundError("person_not_found", "La persona no existe")


def _columns(person: Person) -> dict[str, Any]:
    return {column.key: getattr(person, column.key) for column in Person.__table__.columns}


def list_people(
    session: Session,
    params: PageParams,
    *,
    role: Role | None = None,
    active: bool | None = None,
) -> Page[PersonOut]:
    filters: list[ColumnElement[bool]] = []
    if role is not None:
        filters.append(Person.role == role)
    if active is not None:
        filters.append(Person.active.is_(active))
    total = session.scalar(select(func.count()).select_from(Person).where(*filters)) or 0
    people = session.scalars(
        select(Person)
        .where(*filters)
        .order_by(Person.full_name, Person.id)
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    items = [PersonOut.model_validate(person) for person in people]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


def _open_assignments(session: Session, person_id: int) -> int:
    return (
        session.scalar(
            select(func.count())
            .select_from(Incident)
            .where(
                Incident.assigned_technician_id == person_id,
                Incident.status.in_(ASSIGNED_STATES),
            )
        )
        or 0
    )


def get_person(session: Session, person_id: int) -> PersonDetail:
    person = session.get(Person, person_id, populate_existing=True)
    if person is None:
        raise _not_found()
    worked = session.scalar(
        select(func.coalesce(func.sum(WorkLog.minutes), 0)).where(
            WorkLog.technician_id == person_id
        )
    )
    return PersonDetail.model_validate(
        _columns(person)
        | {"worked_minutes": worked or 0, "open_assignments": _open_assignments(session, person_id)}
    )


def create_person(session: Session, actor_id: int | None, data: PersonCreate) -> PersonDetail:
    if actor_id is None:
        _check_bootstrap(session, data)
    else:
        require_actor(session, actor_id, MANAGERS)
    person = Person(**data.model_dump())
    session.add(person)
    session.commit()
    return get_person(session, person.id)


def _check_bootstrap(session: Session, data: PersonCreate) -> None:
    """Alta inicial: sin actor solo se admite el primer responsable de una base vacía.

    El bloqueo de tabla serializa dos altas iniciales simultáneas.
    """
    session.execute(text("LOCK TABLE people IN SHARE ROW EXCLUSIVE MODE"))
    if session.scalar(select(func.count()).select_from(Person)):
        check_actor(None, None, MANAGERS)
    if data.role != Role.RESPONSABLE:
        raise InvalidDataError(
            "bootstrap_requires_responsable",
            "La primera persona debe ser un responsable",
        )


def update_person(
    session: Session, actor_id: int | None, person_id: int, data: PersonUpdate
) -> PersonDetail:
    if actor_id is None:
        check_actor(None, None, MANAGERS)
    changes = data.model_dump(exclude_unset=True)
    affects_role = "role" in changes or changes.get("active") is False
    # Actor, persona y, si cambia rol o vigencia, todos los responsables activos, en orden.
    locked = lock_people(session, [actor_id, person_id], include_active_responsables=affects_role)
    check_actor(actor_id, locked.get(actor_id) if actor_id else None, MANAGERS)
    person = locked.get(person_id)
    if person is None:
        raise _not_found()

    deactivating = person.active and changes.get("active") is False
    role_changing = "role" in changes and changes["role"] != person.role
    if deactivating or role_changing:
        _check_can_leave_role(session, person, "baja" if deactivating else "cambio de rol")
    for key, value in changes.items():
        setattr(person, key, value)
    session.commit()
    return get_person(session, person.id)


def _check_can_leave_role(session: Session, person: Person, action: str) -> None:
    if person.role == Role.TECNICO:
        pending = _open_assignments(session, person.id)
        if pending:
            raise ConflictError(
                "technician_has_open_incidents",
                f"No se permite la {action}: tiene {pending} avería(s) asignadas o en curso. "
                "Reasígnalas primero",
            )
    if person.role == Role.RESPONSABLE and person.active:
        # Consulta nueva tras los bloqueos: ve las bajas confirmadas mientras se esperaba.
        others = session.scalar(
            select(func.count())
            .select_from(Person)
            .where(Person.role == Role.RESPONSABLE, Person.active, Person.id != person.id)
        )
        if not others:
            raise ConflictError(
                "last_responsable",
                f"No se permite la {action} del último responsable activo",
            )


def retire_person(session: Session, actor_id: int | None, person_id: int) -> None:
    """Baja lógica: la persona queda inactiva y conserva sus registros."""
    update_person(session, actor_id, person_id, PersonUpdate(active=False))
