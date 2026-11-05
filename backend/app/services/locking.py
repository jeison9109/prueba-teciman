"""Bloqueos de fila y comprobación del actor.

Orden de adquisición común a todos los servicios, para evitar interbloqueos:

1. Personas (actor, persona objetivo, técnicos y responsables), en una sola consulta
   ordenada por ID ascendente.
2. Máquinas.
3. Averías.

Tras adquirir los bloqueos, los servicios vuelven a evaluar sus precondiciones con
consultas nuevas: en READ COMMITTED cada sentencia ve lo confirmado tras la espera.
"""

from collections.abc import Collection, Iterable

from sqlalchemy import ColumnElement, and_, or_, select
from sqlalchemy.orm import Session

from app.errors import ForbiddenError
from app.models import Machine, Person
from app.models.enums import Role

ROLE_LABELS = {
    Role.TECNICO: "técnico",
    Role.OPERARIO: "operario",
    Role.RESPONSABLE: "responsable",
}


def lock_people(
    session: Session,
    ids: Iterable[int | None],
    *,
    include_active_responsables: bool = False,
    read: bool = False,
) -> dict[int, Person]:
    """Bloquea las personas indicadas (y, si se pide, todos los responsables activos).

    `read=True` usa FOR SHARE: impide cambios concurrentes de rol o vigencia sin bloquear
    a otros lectores. Sin él se usa FOR UPDATE.
    """
    wanted = [person_id for person_id in ids if person_id is not None]
    condition: ColumnElement[bool] = Person.id.in_(wanted)
    if include_active_responsables:
        condition = or_(condition, and_(Person.role == Role.RESPONSABLE, Person.active))
    statement = (
        select(Person)
        .where(condition)
        .order_by(Person.id)
        .with_for_update(read=read)
        .execution_options(populate_existing=True)
    )
    return {person.id: person for person in session.scalars(statement)}


def check_actor(actor_id: int | None, actor: Person | None, roles: Collection[Role]) -> Person:
    """Valida que el actor exista, esté activo y tenga uno de los roles permitidos."""
    if actor_id is None:
        raise ForbiddenError(
            "actor_required", "Selecciona una persona activa para realizar cambios"
        )
    if actor is None:
        raise ForbiddenError("actor_not_found", "La persona activa seleccionada no existe")
    if not actor.active:
        raise ForbiddenError("actor_inactive", "La persona activa seleccionada está de baja")
    if actor.role not in roles:
        allowed = ", ".join(ROLE_LABELS[role] for role in roles)
        raise ForbiddenError(
            "actor_role_forbidden", f"Esta acción solo la puede realizar: {allowed}"
        )
    return actor


def require_actor(session: Session, actor_id: int | None, roles: Collection[Role]) -> Person:
    """Carga y bloquea en modo compartido al actor de una escritura y valida su rol."""
    actor = lock_people(session, [actor_id], read=True).get(actor_id) if actor_id else None
    return check_actor(actor_id, actor, roles)


def lock_machine(session: Session, machine_id: int) -> Machine | None:
    statement = (
        select(Machine)
        .where(Machine.id == machine_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return session.scalars(statement).one_or_none()
