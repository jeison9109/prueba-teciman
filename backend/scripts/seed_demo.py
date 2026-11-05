"""Carga explícita e idempotente de datos de demostración.

Uso (con la base ya migrada):

    docker compose exec backend python -m scripts.seed_demo
    cd backend && uv run python -m scripts.seed_demo        # fuera de Docker

Crea 6 máquinas, 7 personas y 12 averías repartidas por los cinco estados, con fechas
relativas al momento de la carga para que sean coherentes con las reglas (detección pasada,
imputaciones entre el día de detección y hoy). Incluye:

- PRE-001 con dos averías abiertas que causan parada (estado efectivo «en avería»).
- AV de PRE-001 cerrada con imputaciones de dos técnicos (1,25 h + 0,75 h = 2 h) y una
  solución que se encuentra buscando «junta tórica» o «purga».
- HOR-006 de baja con su historial cerrado, y una técnica inactiva con imputaciones antiguas.

Idempotencia: máquinas por código, personas por email y averías por máquina y título. Lo que
ya existe no se modifica ni se duplica, así que ejecutarlo dos veces deja la base igual y
convive con datos creados a mano. Todo va en una transacción con un bloqueo consultivo para
que dos cargas simultáneas no se pisen.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_engine
from app.models import Incident, Machine, Person, WorkLog, incident_number_seq
from app.models.enums import (
    Criticality,
    FailureType,
    IncidentStatus,
    MachineAdminStatus,
    Priority,
    Role,
    SolutionType,
    Specialty,
)
from app.services import clock

# Clave arbitraria del bloqueo consultivo de la carga demo.
SEED_LOCK_KEY = 4_202_611


@dataclass(frozen=True)
class MachineSeed:
    code: str
    name: str
    type: str
    location: str
    criticality: Criticality
    manufacturer: str
    model: str
    serial_number: str
    commissioning_date: date
    admin_status: MachineAdminStatus = MachineAdminStatus.OPERATIVA


@dataclass(frozen=True)
class PersonSeed:
    key: str
    full_name: str
    role: Role
    email: str
    specialty: Specialty | None = None
    phone: str | None = None
    hourly_cost: str | None = None
    active: bool = True


@dataclass(frozen=True)
class LogSeed:
    technician: str
    hours: str
    description: str
    # Desplazamiento desde la detección; la fecha de trabajo nunca pasa de hoy.
    after: timedelta = timedelta(hours=1)


@dataclass(frozen=True)
class IncidentSeed:
    machine: str
    title: str
    symptom: str
    failure_type: FailureType
    priority: Priority
    stopped: bool
    reporter: str
    status: IncidentStatus
    detected_ago: timedelta
    technician: str | None = None
    resolved_after: timedelta | None = None
    closed_after: timedelta | None = None
    closer: str | None = None
    root_cause: str | None = None
    solution: str | None = None
    replaced_parts: str | None = None
    solution_type: SolutionType | None = None
    preventive_recommendation: str | None = None
    logs: tuple[LogSeed, ...] = field(default_factory=tuple)


EMAIL_DOMAIN = "demo.teciman.local"

MACHINES = (
    MachineSeed(
        "PRE-001",
        "Prensa hidráulica 250 t",
        "Prensa",
        "Nave 1",
        Criticality.ALTA,
        "Loire Safe",
        "PH-250",
        "LS-250-1187",
        date(2016, 3, 14),
    ),
    MachineSeed(
        "CNC-002",
        "Centro de mecanizado vertical",
        "CNC",
        "Nave 2",
        Criticality.ALTA,
        "Haas",
        "VF-4",
        "HV4-33921",
        date(2019, 9, 2),
    ),
    MachineSeed(
        "ROB-003",
        "Robot de soldadura MIG",
        "Robot",
        "Nave 2",
        Criticality.MEDIA,
        "Fanuc",
        "ARC Mate 100iD",
        "FN-100-55410",
        date(2021, 1, 18),
    ),
    MachineSeed(
        "CIN-004",
        "Cinta transportadora de expedición",
        "Transporte",
        "Almacén",
        Criticality.BAJA,
        "Interroll",
        "RollerDrive EC5000",
        "IR-5000-7731",
        date(2018, 6, 4),
    ),
    MachineSeed(
        "COM-005",
        "Compresor de tornillo 37 kW",
        "Compresor",
        "Sala de compresores",
        Criticality.MEDIA,
        "Atlas Copco",
        "GA 37",
        "AC-GA37-90112",
        date(2017, 11, 20),
    ),
    MachineSeed(
        "HOR-006",
        "Horno de tratamiento térmico (retirado)",
        "Horno",
        "Nave 3",
        Criticality.MEDIA,
        "Nabertherm",
        "N 250/85HA",
        "NB-250-2209",
        date(2009, 5, 11),
        admin_status=MachineAdminStatus.DE_BAJA,
    ),
)

PEOPLE = (
    PersonSeed("rosa", "Rosa Martín Vidal", Role.RESPONSABLE, "rosa.martin", phone="600 100 200"),
    PersonSeed("diego", "Diego Sanz Ortega", Role.RESPONSABLE, "diego.sanz"),
    PersonSeed("olga", "Olga Pérez Ríos", Role.OPERARIO, "olga.perez"),
    PersonSeed(
        "tomas",
        "Tomás García León",
        Role.TECNICO,
        "tomas.garcia",
        specialty=Specialty.MECANICA,
        hourly_cost="38.50",
    ),
    PersonSeed(
        "teresa",
        "Teresa López Gil",
        Role.TECNICO,
        "teresa.lopez",
        specialty=Specialty.ELECTRICA,
        hourly_cost="40.00",
    ),
    PersonSeed(
        "hugo",
        "Hugo Ruiz Navarro",
        Role.TECNICO,
        "hugo.ruiz",
        specialty=Specialty.HIDRAULICA,
        hourly_cost="36.00",
    ),
    PersonSeed(
        "ines",
        "Inés Moreno Cano",
        Role.TECNICO,
        "ines.moreno",
        specialty=Specialty.ELECTRONICA,
        active=False,
    ),
)

H = timedelta(hours=1)
D = timedelta(days=1)
DAY_SHIFT_START = time(8, 15)

INCIDENTS = (
    # --- Cerradas ------------------------------------------------------------------------
    IncidentSeed(
        "HOR-006",
        "Resistencia quemada en la zona 2",
        "La zona 2 no alcanza la consigna de 850 °C y el horno da alarma de desviación.",
        FailureType.ELECTRICO,
        Priority.ALTA,
        True,
        "olga",
        IncidentStatus.CERRADA,
        120 * D,
        technician="ines",
        resolved_after=6 * H,
        closed_after=D,
        closer="rosa",
        root_cause="Resistencia de la zona 2 cortada por fatiga térmica.",
        solution="Sustitución de la resistencia de la zona 2 y comprobación de consumo por fase.",
        replaced_parts="Resistencia Kanthal 9 kW ref. NB-R9 (1 ud.)",
        solution_type=SolutionType.SUSTITUCION,
        logs=(LogSeed("ines", "4", "Diagnóstico por zonas y cambio de resistencia"),),
    ),
    IncidentSeed(
        "HOR-006",
        "Termopar con lecturas erráticas",
        "La temperatura mostrada salta ±40 °C sin cambios en el proceso.",
        FailureType.ELECTRONICO,
        Priority.MEDIA,
        False,
        "olga",
        IncidentStatus.CERRADA,
        95 * D,
        technician="ines",
        resolved_after=3 * H,
        closed_after=2 * D,
        closer="rosa",
        root_cause="Cable compensado del termopar pelado junto a la puerta.",
        solution="Sustitución del termopar tipo K y recableado con funda de fibra de vidrio.",
        replaced_parts="Termopar tipo K 300 mm (1 ud.)",
        solution_type=SolutionType.SUSTITUCION,
        preventive_recommendation="Revisar el recorrido de cables cerca de la puerta cada mes.",
        logs=(LogSeed("ines", "1.5", "Medición con calibrador y sustitución del termopar"),),
    ),
    IncidentSeed(
        "PRE-001",
        "Pérdida de presión en el circuito hidráulico",
        "La prensa no llega a 250 t y aparece aceite en la base del cilindro principal.",
        FailureType.HIDRAULICO,
        Priority.URGENTE,
        True,
        "olga",
        IncidentStatus.CERRADA,
        12 * D,
        technician="tomas",
        resolved_after=5 * H,
        closed_after=D,
        closer="rosa",
        root_cause="Junta tórica del vástago del cilindro principal cristalizada por temperatura.",
        solution="Sustitución de la junta tórica del vástago y purga del circuito hidráulico. "
        "Prueba a 250 t sin fugas durante 30 minutos.",
        replaced_parts="Junta tórica NBR 120x5 (2 uds.); aceite HLP 46 (20 l)",
        solution_type=SolutionType.SUSTITUCION,
        preventive_recommendation="Comprobar la temperatura del aceite y revisar juntas cada "
        "500 horas.",
        logs=(
            LogSeed("tomas", "1.25", "Desmontaje del cilindro y cambio de junta", after=H),
            LogSeed("hugo", "0.75", "Purga del circuito y prueba de presión", after=3 * H),
        ),
    ),
    IncidentSeed(
        "COM-005",
        "Fuga de aire en el secador frigorífico",
        "Silbido continuo en el secador y caída de presión de 0,5 bar en la red.",
        FailureType.NEUMATICO,
        Priority.MEDIA,
        False,
        "olga",
        IncidentStatus.CERRADA,
        8 * D,
        technician="hugo",
        resolved_after=2 * H,
        closed_after=D,
        closer="diego",
        root_cause="Racor de entrada del secador flojo por vibraciones.",
        solution="Reapriete del racor de entrada con sellador anaeróbico.",
        solution_type=SolutionType.AJUSTE,
        logs=(LogSeed("hugo", "0.5", "Localización con espuma y reapriete del racor"),),
    ),
    # --- Resueltas -----------------------------------------------------------------------
    IncidentSeed(
        "CNC-002",
        "Alarma de sobretemperatura en el cabezal",
        "El control muestra alarma 1068 de temperatura del cabezal tras 20 minutos de trabajo.",
        FailureType.ELECTRICO,
        Priority.ALTA,
        True,
        "olga",
        IncidentStatus.RESUELTA,
        4 * D,
        technician="teresa",
        resolved_after=4 * H,
        root_cause="Ventilador del motor del cabezal bloqueado por virutas.",
        solution="Limpieza del ventilador y sustitución del filtro de entrada de aire.",
        replaced_parts="Filtro de aire del armario 250x250 (1 ud.)",
        solution_type=SolutionType.DEFINITIVA,
        logs=(LogSeed("teresa", "2", "Diagnóstico de alarma y limpieza del ventilador"),),
    ),
    IncidentSeed(
        "ROB-003",
        "Hilo de soldadura atascado en la sirga",
        "El robot se detiene con error de avance de hilo a mitad de cordón.",
        FailureType.MECANICO,
        Priority.MEDIA,
        True,
        "olga",
        IncidentStatus.RESUELTA,
        3 * D,
        technician="tomas",
        resolved_after=2 * H,
        root_cause="Sirga de guiado obstruida por restos de cobre.",
        solution="Sustitución de la sirga y ajuste de la presión de los rodillos de arrastre.",
        replaced_parts="Sirga de acero 1,0-1,2 mm 5 m (1 ud.)",
        solution_type=SolutionType.SUSTITUCION,
        logs=(LogSeed("tomas", "1.5", "Cambio de sirga y prueba de soldadura"),),
    ),
    # --- En curso ------------------------------------------------------------------------
    IncidentSeed(
        "CNC-002",
        "Vibración del husillo a altas revoluciones",
        "Vibraciones y ruido por encima de 8000 rpm; mal acabado superficial.",
        FailureType.MECANICO,
        Priority.ALTA,
        True,
        "olga",
        IncidentStatus.EN_CURSO,
        2 * D,
        technician="tomas",
        logs=(
            LogSeed("tomas", "1.5", "Medición de vibraciones y desmontaje del portaherramientas"),
        ),
    ),
    IncidentSeed(
        "COM-005",
        "Presión de aire baja en la red",
        "La red no supera 6 bar en el turno de mañana con todas las máquinas en marcha.",
        FailureType.NEUMATICO,
        Priority.MEDIA,
        False,
        "olga",
        IncidentStatus.EN_CURSO,
        D,
        technician="hugo",
        logs=(LogSeed("hugo", "0.75", "Revisión de purgas y consumo por ramal"),),
    ),
    # --- Asignadas -----------------------------------------------------------------------
    IncidentSeed(
        "ROB-003",
        "Error de comunicación con el controlador",
        "Aviso intermitente de pérdida de comunicación entre la consola y el armario.",
        FailureType.ELECTRONICO,
        Priority.MEDIA,
        False,
        "olga",
        IncidentStatus.ASIGNADA,
        20 * H,
        technician="teresa",
    ),
    IncidentSeed(
        "PRE-001",
        "Ruido metálico en la bomba hidráulica",
        "Golpeteo en la bomba al arrancar; se para la prensa por seguridad.",
        FailureType.HIDRAULICO,
        Priority.ALTA,
        True,
        "rosa",
        IncidentStatus.ASIGNADA,
        5 * H,
        technician="hugo",
    ),
    # --- Abiertas ------------------------------------------------------------------------
    IncidentSeed(
        "PRE-001",
        "Fuga de aceite en el latiguillo del cojín",
        "Goteo de aceite en el latiguillo del cojín; la prensa sigue parada.",
        FailureType.HIDRAULICO,
        Priority.URGENTE,
        True,
        "olga",
        IncidentStatus.ABIERTA,
        2 * H,
    ),
    IncidentSeed(
        "CIN-004",
        "La cinta se detiene de forma intermitente",
        "La cinta se para unos segundos sin alarma y vuelve a arrancar.",
        FailureType.ELECTRICO,
        Priority.BAJA,
        False,
        "olga",
        IncidentStatus.ABIERTA,
        H,
    ),
)


@dataclass
class SeedReport:
    created: Counter[str] = field(default_factory=Counter)
    existing: Counter[str] = field(default_factory=Counter)

    def summary(self) -> str:
        parts = [
            f"{name}: {self.created[name]} nuevas, {self.existing[name]} ya existían"
            for name in ("máquinas", "personas", "averías")
        ]
        return "; ".join([*parts, f"imputaciones nuevas: {self.created['imputaciones']}"])


def _hours_to_minutes(hours: str) -> int:
    return int(Decimal(hours) * 60)


def _machines(session: Session, report: SeedReport) -> dict[str, Machine]:
    codes = [seed.code for seed in MACHINES]
    found = {m.code: m for m in session.scalars(select(Machine).where(Machine.code.in_(codes)))}
    for seed in MACHINES:
        if seed.code in found:
            report.existing["máquinas"] += 1
            continue
        machine = Machine(
            code=seed.code,
            name=seed.name,
            type=seed.type,
            location=seed.location,
            criticality=seed.criticality,
            manufacturer=seed.manufacturer,
            model=seed.model,
            serial_number=seed.serial_number,
            commissioning_date=seed.commissioning_date,
            admin_status=seed.admin_status,
        )
        session.add(machine)
        found[seed.code] = machine
        report.created["máquinas"] += 1
    session.flush()
    return found


def _people(session: Session, report: SeedReport) -> dict[str, Person]:
    emails = {seed.key: f"{seed.email}@{EMAIL_DOMAIN}" for seed in PEOPLE}
    by_email = {
        p.email: p for p in session.scalars(select(Person).where(Person.email.in_(emails.values())))
    }
    people: dict[str, Person] = {}
    for seed in PEOPLE:
        email = emails[seed.key]
        if email in by_email:
            people[seed.key] = by_email[email]
            report.existing["personas"] += 1
            continue
        person = Person(
            full_name=seed.full_name,
            role=seed.role,
            specialty=seed.specialty,
            email=email,
            phone=seed.phone,
            hourly_cost=Decimal(seed.hourly_cost) if seed.hourly_cost else None,
            active=seed.active,
        )
        session.add(person)
        people[seed.key] = person
        report.created["personas"] += 1
    session.flush()
    return people


def _detection(now: datetime, ago: timedelta) -> datetime:
    """Las de hace días se detectan a media mañana (hora local) para que la demo sea realista;
    las de hoy, justo `ago` antes de la carga."""
    if ago < D:
        return now - ago
    zone = get_settings().operation_zone
    day = (now - ago).astimezone(zone).date()
    return datetime.combine(day, DAY_SHIFT_START, tzinfo=zone).astimezone(UTC)


def _incidents(
    session: Session,
    machines: dict[str, Machine],
    people: dict[str, Person],
    report: SeedReport,
) -> None:
    now = clock.now()
    zone = get_settings().operation_zone
    today = clock.local_date(now)
    # Se insertan de la más antigua a la más reciente para que la numeración sea cronológica.
    for seed in sorted(INCIDENTS, key=lambda item: item.detected_ago, reverse=True):
        machine = machines[seed.machine]
        exists = session.scalar(
            select(func.count())
            .select_from(Incident)
            .where(Incident.machine_id == machine.id, Incident.title == seed.title)
        )
        if exists:
            report.existing["averías"] += 1
            continue

        detected = _detection(now, seed.detected_ago)
        resolved = detected + seed.resolved_after if seed.resolved_after else None
        closed = resolved + seed.closed_after if resolved and seed.closed_after else None
        sequence = session.scalar(select(incident_number_seq.next_value()))
        incident = Incident(
            number=f"AV-{detected.astimezone(zone).year}-{sequence:04d}",
            machine_id=machine.id,
            reported_by_id=people[seed.reporter].id,
            detected_at=detected,
            title=seed.title,
            symptom=seed.symptom,
            failure_type=seed.failure_type,
            priority=seed.priority,
            machine_stopped=seed.stopped,
            status=seed.status,
            assigned_technician_id=people[seed.technician].id if seed.technician else None,
            root_cause=seed.root_cause,
            solution=seed.solution,
            replaced_parts=seed.replaced_parts,
            solution_type=seed.solution_type,
            preventive_recommendation=seed.preventive_recommendation,
            resolved_at=resolved,
            closed_at=closed,
            closed_by_id=people[seed.closer].id if seed.closer else None,
        )
        session.add(incident)
        session.flush()
        report.created["averías"] += 1

        for log in seed.logs:
            worked_at = min(detected + log.after, resolved or now, now)
            session.add(
                WorkLog(
                    incident_id=incident.id,
                    technician_id=people[log.technician].id,
                    work_date=min(clock.local_date(worked_at), today),
                    minutes=_hours_to_minutes(log.hours),
                    description=log.description,
                )
            )
            report.created["imputaciones"] += 1
    session.flush()


def seed(session: Session) -> SeedReport:
    """Carga los datos demo que falten, en una sola transacción. No hace commit."""
    session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": SEED_LOCK_KEY})
    report = SeedReport()
    machines = _machines(session, report)
    people = _people(session, report)
    _incidents(session, machines, people, report)
    return report


def main() -> None:
    with Session(get_engine()) as session:
        report = seed(session)
        session.commit()
    print(f"Datos demo cargados. {report.summary()}.")


if __name__ == "__main__":
    main()
