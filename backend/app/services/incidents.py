"""Casos de uso de averías: registro, ciclo de vida e imputaciones.

Cada acción es una transacción. Se bloquean primero las personas implicadas, después la
máquina (solo al registrar) y por último la avería, siguiendo el orden de
`app.services.locking`. Estado, actor y técnico se comprueban ya con los bloqueos tomados.
"""

from datetime import timedelta
from typing import Any

from sqlalchemy import (
    ColumnElement,
    Numeric,
    Select,
    case,
    cast,
    extract,
    func,
    literal,
    or_,
    select,
)
from sqlalchemy.orm import Session, aliased

from app.config import get_settings
from app.errors import ConflictError, FieldError, ForbiddenError, InvalidDataError, NotFoundError
from app.models import Incident, Machine, Person, WorkLog, incident_number_seq
from app.models.enums import IncidentStatus, MachineAdminStatus, Priority, Role
from app.schemas.common import Page, PageParams
from app.schemas.incident import (
    AssignInput,
    HistoryItem,
    HistoryParams,
    IncidentCreate,
    IncidentDetail,
    IncidentOut,
    MachineRef,
    PersonRef,
    ResolveInput,
    WorkLogCreate,
    WorkLogOut,
)
from app.services import clock
from app.services.locking import (
    check_actor,
    lock_incident,
    lock_machine,
    lock_people,
    require_actor,
)
from app.services.machines import effective_status

ANY_ROLE = (Role.TECNICO, Role.OPERARIO, Role.RESPONSABLE)
MANAGERS = (Role.RESPONSABLE,)
TECHNICIANS = (Role.TECNICO,)

# Margen frente al reloj del navegador al comprobar que la detección no es futura.
FUTURE_TOLERANCE = timedelta(minutes=2)

STATUS_LABELS = {
    IncidentStatus.ABIERTA: "abierta",
    IncidentStatus.ASIGNADA: "asignada",
    IncidentStatus.EN_CURSO: "en curso",
    IncidentStatus.RESUELTA: "resuelta",
    IncidentStatus.CERRADA: "cerrada",
}

Reporter = aliased(Person, name="reporter")
Technician = aliased(Person, name="technician")
Closer = aliased(Person, name="closer")


def _not_found() -> NotFoundError:
    return NotFoundError("incident_not_found", "La avería no existe")


def _invalid_transition(action: str, incident: Incident) -> ConflictError:
    return ConflictError(
        "incident_invalid_transition",
        f"No se puede {action} una avería {STATUS_LABELS[incident.status]}",
    )


# --- Lectura ---------------------------------------------------------------------------


def _worked_minutes() -> ColumnElement[int]:
    return (
        select(func.coalesce(func.sum(WorkLog.minutes), 0))
        .where(WorkLog.incident_id == Incident.id)
        .scalar_subquery()
    )


def _downtime_hours() -> ColumnElement[Any]:
    """Tiempo de parada en horas: 0 sin parada y nulo mientras siga abierta."""
    seconds = extract("epoch", Incident.resolved_at - Incident.detected_at)
    return case(
        (Incident.machine_stopped.is_(False), literal(0)),
        (Incident.resolved_at.is_(None), None),
        else_=func.round(cast(seconds, Numeric) / 3600, 2),
    )


def _base_query() -> Select[Any]:
    """Avería con máquina, personas, horas y parada en una sola consulta (sin N+1)."""
    return (
        select(
            Incident,
            Machine.code,
            Machine.name,
            effective_status(),
            Reporter.full_name,
            Technician.full_name,
            Closer.full_name,
            _worked_minutes(),
            _downtime_hours(),
        )
        .join(Machine, Machine.id == Incident.machine_id)
        .join(Reporter, Reporter.id == Incident.reported_by_id)
        .outerjoin(Technician, Technician.id == Incident.assigned_technician_id)
        .outerjoin(Closer, Closer.id == Incident.closed_by_id)
    )


def _ref(person_id: int | None, name: str | None) -> PersonRef | None:
    return PersonRef(id=person_id, full_name=name) if person_id is not None and name else None


def _fields(row: Any) -> dict[str, Any]:
    incident: Incident = row[0]
    machine_code, machine_name, machine_status = row[1], row[2], row[3]
    reporter, technician, closer, worked, downtime = row[4], row[5], row[6], row[7], row[8]
    values = {column.key: getattr(incident, column.key) for column in Incident.__table__.columns}
    return values | {
        "machine": MachineRef(
            id=incident.machine_id, code=machine_code, name=machine_name, status=machine_status
        ),
        "reported_by": PersonRef(id=incident.reported_by_id, full_name=reporter),
        "assigned_technician": _ref(incident.assigned_technician_id, technician),
        "closed_by": _ref(incident.closed_by_id, closer),
        "worked_minutes": worked,
        "downtime_hours": float(downtime) if downtime is not None else None,
    }


def list_incidents(
    session: Session,
    params: PageParams,
    *,
    machine_id: int | None = None,
    status: IncidentStatus | None = None,
    priority: Priority | None = None,
) -> Page[IncidentOut]:
    filters: list[ColumnElement[bool]] = []
    if machine_id is not None:
        filters.append(Incident.machine_id == machine_id)
    if status is not None:
        filters.append(Incident.status == status)
    if priority is not None:
        filters.append(Incident.priority == priority)
    total = session.scalar(select(func.count()).select_from(Incident).where(*filters)) or 0
    rows = session.execute(
        _base_query()
        .where(*filters)
        .order_by(Incident.detected_at.desc(), Incident.id.desc())
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    items = [IncidentOut.model_validate(_fields(row)) for row in rows]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


def list_history(session: Session, params: PageParams, filters: HistoryParams) -> Page[HistoryItem]:
    """Histórico de conocimiento: averías resueltas y cerradas, más reciente primero.

    Los textos buscan coincidencia parcial sin distinguir mayúsculas (ILIKE con parámetros;
    `%` y `_` del usuario se escapan). Incluye máquinas de baja.
    """
    conditions: list[ColumnElement[bool]] = [
        Incident.status.in_((IncidentStatus.RESUELTA, IncidentStatus.CERRADA))
    ]
    if filters.machine_id is not None:
        conditions.append(Incident.machine_id == filters.machine_id)
    if filters.symptom:
        conditions.append(Incident.symptom.icontains(filters.symptom, autoescape=True))
    if filters.root_cause:
        conditions.append(Incident.root_cause.icontains(filters.root_cause, autoescape=True))
    if filters.q:
        searched = (
            Machine.code,
            Machine.name,
            Incident.title,
            Incident.symptom,
            Incident.root_cause,
            Incident.solution,
        )
        conditions.append(
            or_(*(column.icontains(filters.q, autoescape=True) for column in searched))
        )
    total = (
        session.scalar(
            select(func.count())
            .select_from(Incident)
            .join(Machine, Machine.id == Incident.machine_id)
            .where(*conditions)
        )
        or 0
    )
    rows = session.execute(
        _base_query()
        .where(*conditions)
        .order_by(Incident.resolved_at.desc(), Incident.id.desc())
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    items = [HistoryItem.model_validate(_fields(row)) for row in rows]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


def get_incident(session: Session, incident_id: int) -> IncidentDetail:
    row = session.execute(
        _base_query().where(Incident.id == incident_id).execution_options(populate_existing=True)
    ).one_or_none()
    if row is None:
        raise _not_found()
    return IncidentDetail.model_validate(_fields(row))


# --- Registro --------------------------------------------------------------------------


def create_incident(session: Session, actor_id: int | None, data: IncidentCreate) -> IncidentDetail:
    """Registra una avería abierta. Cualquier persona activa; queda como reportante."""
    actor = require_actor(session, actor_id, ANY_ROLE)
    # FOR SHARE: la máquina no se puede dar de baja mientras se registra la avería.
    machine = lock_machine(session, data.machine_id, read=True)
    if machine is None:
        raise InvalidDataError(
            "machine_not_found",
            "La máquina no existe",
            [FieldError("machine_id", "La máquina no existe")],
        )
    if machine.admin_status == MachineAdminStatus.DE_BAJA:
        raise ConflictError(
            "machine_retired",
            "La máquina está de baja y no admite nuevas averías",
            [FieldError("machine_id", "La máquina está de baja")],
        )

    current = clock.now()
    detected = clock.as_aware(data.detected_at)
    if detected > current + FUTURE_TOLERANCE:
        raise InvalidDataError(
            "detected_in_future",
            "La detección no puede ser posterior a la hora actual",
            [FieldError("detected_at", "No puede ser posterior a la hora actual")],
        )
    # Dentro del margen se toma la hora del servidor para que la resolución nunca la preceda.
    detected = min(detected, current)

    sequence = session.scalar(select(incident_number_seq.next_value()))
    year = current.astimezone(get_settings().operation_zone).year
    incident = Incident(
        number=f"AV-{year}-{sequence:04d}",
        machine_id=machine.id,
        reported_by_id=actor.id,
        detected_at=detected,
        title=data.title,
        symptom=data.symptom,
        failure_type=data.failure_type,
        priority=data.priority,
        machine_stopped=data.machine_stopped,
        status=IncidentStatus.ABIERTA,
    )
    session.add(incident)
    session.commit()
    return get_incident(session, incident.id)


# --- Ciclo de vida ---------------------------------------------------------------------


def _check_technician(person: Person | None) -> Person:
    if person is None:
        raise InvalidDataError(
            "technician_not_found",
            "La persona seleccionada no existe",
            [FieldError("technician_id", "La persona seleccionada no existe")],
        )
    if person.role != Role.TECNICO:
        raise InvalidDataError(
            "not_a_technician",
            "Solo se puede asignar a un técnico",
            [FieldError("technician_id", "Solo se puede asignar a un técnico")],
        )
    if not person.active:
        raise ConflictError(
            "technician_inactive",
            "El técnico seleccionado está de baja",
            [FieldError("technician_id", "El técnico seleccionado está de baja")],
        )
    return person


def _locked_incident(session: Session, incident_id: int) -> Incident:
    incident = lock_incident(session, incident_id)
    if incident is None:
        raise _not_found()
    return incident


def _set_technician(
    session: Session,
    actor_id: int | None,
    incident_id: int,
    data: AssignInput,
    *,
    reassign: bool,
) -> IncidentDetail:
    # FOR SHARE sobre actor y técnico: una baja o cambio de rol concurrente espera y, al
    # continuar, ve esta asignación.
    locked = lock_people(session, [actor_id, data.technician_id], read=True)
    check_actor(actor_id, locked.get(actor_id) if actor_id else None, MANAGERS)
    incident = _locked_incident(session, incident_id)
    if reassign:
        if incident.status not in (IncidentStatus.ASIGNADA, IncidentStatus.EN_CURSO):
            raise _invalid_transition("reasignar", incident)
        if incident.assigned_technician_id == data.technician_id:
            raise InvalidDataError(
                "same_technician",
                "La avería ya está asignada a ese técnico",
                [FieldError("technician_id", "Elige otro técnico")],
            )
    elif incident.status != IncidentStatus.ABIERTA:
        raise _invalid_transition("asignar", incident)

    technician = _check_technician(locked.get(data.technician_id))
    incident.assigned_technician_id = technician.id
    if not reassign:
        incident.status = IncidentStatus.ASIGNADA
    session.commit()
    return get_incident(session, incident.id)


def assign(
    session: Session, actor_id: int | None, incident_id: int, data: AssignInput
) -> IncidentDetail:
    """Abierta → asignada. Responsable activo; técnico activo."""
    return _set_technician(session, actor_id, incident_id, data, reassign=False)


def reassign(
    session: Session, actor_id: int | None, incident_id: int, data: AssignInput
) -> IncidentDetail:
    """Cambia el técnico de una avería asignada o en curso sin cambiar su estado.
    Las imputaciones anteriores conservan a su autor."""
    return _set_technician(session, actor_id, incident_id, data, reassign=True)


def _check_assigned(incident: Incident, actor: Person, action: str) -> None:
    if incident.assigned_technician_id != actor.id:
        raise ForbiddenError(
            "actor_not_assigned", f"Solo el técnico asignado puede {action} la avería"
        )


def start(session: Session, actor_id: int | None, incident_id: int) -> IncidentDetail:
    """Asignada → en curso. Técnico activo asignado."""
    actor = require_actor(session, actor_id, TECHNICIANS)
    incident = _locked_incident(session, incident_id)
    if incident.status != IncidentStatus.ASIGNADA:
        raise _invalid_transition("iniciar", incident)
    _check_assigned(incident, actor, "iniciar")
    incident.status = IncidentStatus.EN_CURSO
    session.commit()
    return get_incident(session, incident.id)


def resolve(
    session: Session, actor_id: int | None, incident_id: int, data: ResolveInput
) -> IncidentDetail:
    """En curso → resuelta. Técnico activo asignado; causa y solución obligatorias."""
    actor = require_actor(session, actor_id, TECHNICIANS)
    incident = _locked_incident(session, incident_id)
    if incident.status != IncidentStatus.EN_CURSO:
        raise _invalid_transition("resolver", incident)
    _check_assigned(incident, actor, "resolver")
    for key, value in data.model_dump().items():
        setattr(incident, key, value)
    incident.resolved_at = clock.now()
    incident.status = IncidentStatus.RESUELTA
    session.commit()
    return get_incident(session, incident.id)


def close(session: Session, actor_id: int | None, incident_id: int) -> IncidentDetail:
    """Resuelta → cerrada. Responsable activo, que queda como validador."""
    actor = require_actor(session, actor_id, MANAGERS)
    incident = _locked_incident(session, incident_id)
    if incident.status != IncidentStatus.RESUELTA:
        raise _invalid_transition("cerrar", incident)
    incident.closed_by_id = actor.id
    incident.closed_at = clock.now()
    incident.status = IncidentStatus.CERRADA
    session.commit()
    return get_incident(session, incident.id)


# --- Imputaciones ----------------------------------------------------------------------


def _work_log_out(log: WorkLog, technician_name: str) -> WorkLogOut:
    return WorkLogOut(
        id=log.id,
        incident_id=log.incident_id,
        technician=PersonRef(id=log.technician_id, full_name=technician_name),
        work_date=log.work_date,
        minutes=log.minutes,
        description=log.description,
        created_at=log.created_at,
    )


def list_work_logs(session: Session, incident_id: int, params: PageParams) -> Page[WorkLogOut]:
    if session.get(Incident, incident_id) is None:
        raise _not_found()
    condition = WorkLog.incident_id == incident_id
    total = session.scalar(select(func.count()).select_from(WorkLog).where(condition)) or 0
    rows = session.execute(
        select(WorkLog, Person.full_name)
        .join(Person, Person.id == WorkLog.technician_id)
        .where(condition)
        .order_by(WorkLog.work_date, WorkLog.id)
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    items = [_work_log_out(log, name) for log, name in rows]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


def add_work_log(
    session: Session, actor_id: int | None, incident_id: int, data: WorkLogCreate
) -> WorkLogOut:
    """Imputa trabajo propio en una avería en curso. Cualquier técnico activo puede colaborar."""
    actor = require_actor(session, actor_id, TECHNICIANS)
    incident = _locked_incident(session, incident_id)
    if incident.status != IncidentStatus.EN_CURSO:
        raise ConflictError(
            "incident_not_in_progress",
            f"Solo se imputa trabajo en averías en curso; esta está "
            f"{STATUS_LABELS[incident.status]}",
        )
    detection_day = clock.local_date(incident.detected_at)
    today = clock.local_date(clock.now())
    if data.work_date < detection_day:
        message = f"No puede ser anterior al día de detección ({detection_day:%d/%m/%Y})"
        raise InvalidDataError(
            "work_date_before_detection", message, [FieldError("work_date", message)]
        )
    if data.work_date > today:
        message = "No puede ser posterior a hoy"
        raise InvalidDataError("work_date_in_future", message, [FieldError("work_date", message)])

    log = WorkLog(
        incident_id=incident.id,
        technician_id=actor.id,
        work_date=data.work_date,
        minutes=data.minutes,
        description=data.description,
    )
    session.add(log)
    session.commit()
    return _work_log_out(log, actor.full_name)
