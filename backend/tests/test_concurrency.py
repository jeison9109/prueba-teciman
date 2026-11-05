"""Escrituras concurrentes sobre invariantes que dependen de otras filas."""

import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from functools import partial

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.errors import ConflictError, DomainError
from app.schemas.incident import (
    AssignInput,
    IncidentCreate,
    IncidentDetail,
    ResolveInput,
    WorkLogCreate,
    WorkLogOut,
)
from app.schemas.machine import MachineCreate
from app.schemas.person import PersonCreate
from app.services import incidents, machines, people


def run_concurrently(engine: Engine, *tasks: Callable[[Session], object]) -> list[object]:
    """Lanza cada tarea en su propia sesión a la vez y devuelve resultado o excepción."""
    barrier = threading.Barrier(len(tasks))
    results: list[object] = [None] * len(tasks)

    def worker(index: int, task: Callable[[Session], object]) -> None:
        with Session(engine, expire_on_commit=False) as session:
            barrier.wait()
            try:
                results[index] = task(session)
            except DomainError as error:
                results[index] = error

    threads = [threading.Thread(target=worker, args=item) for item in enumerate(tasks)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)
    return results


def _seed_two_responsables(engine: Engine) -> tuple[int, int]:
    with Session(engine, expire_on_commit=False) as session:
        first = people.create_person(
            session, None, PersonCreate(full_name="Rosa", role="responsable")
        ).id
        second = people.create_person(
            session, first, PersonCreate(full_name="Rafa", role="responsable")
        ).id
    return first, second


def retire_self(session: Session, person_id: int) -> None:
    people.retire_person(session, person_id, person_id)


def test_dos_responsables_no_pueden_darse_de_baja_a_la_vez(api_engine: Engine) -> None:
    for _ in range(5):
        with api_engine.begin() as connection:
            connection.exec_driver_sql("TRUNCATE people RESTART IDENTITY CASCADE")
        first, second = _seed_two_responsables(api_engine)
        results = run_concurrently(
            api_engine,
            partial(retire_self, person_id=first),
            partial(retire_self, person_id=second),
        )
        conflicts = [r for r in results if isinstance(r, ConflictError)]
        assert len(conflicts) == 1, results
        assert conflicts[0].code == "last_responsable"


def test_alta_simultanea_con_el_mismo_codigo(api_engine: Engine) -> None:
    first, _ = _seed_two_responsables(api_engine)
    data = MachineCreate(code="PRE-1", name="P", type="T", location="L", criticality="alta")
    results = run_concurrently(
        api_engine,
        lambda s: machines.create_machine(s, first, data),
        lambda s: machines.create_machine(s, first, data),
    )
    conflicts = [r for r in results if isinstance(r, ConflictError)]
    assert len(conflicts) == 1, results
    assert conflicts[0].code == "machine_code_taken"


# --- Averías ---------------------------------------------------------------------------


class Flow:
    """Responsable, dos técnicos, una máquina y una avería abierta creados por servicio."""

    def __init__(self, engine: Engine) -> None:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "TRUNCATE work_logs, incidents, people, machines RESTART IDENTITY CASCADE"
            )
        self.engine = engine
        with Session(engine, expire_on_commit=False) as session:
            self.boss = people.create_person(
                session, None, PersonCreate(full_name="Rosa", role="responsable")
            ).id
            self.boss2 = people.create_person(
                session, self.boss, PersonCreate(full_name="Rafa", role="responsable")
            ).id
            self.tech = people.create_person(
                session, self.boss, PersonCreate(full_name="Tomás", role="tecnico")
            ).id
            self.tech2 = people.create_person(
                session, self.boss, PersonCreate(full_name="Teresa", role="tecnico")
            ).id
            self.machine = machines.create_machine(
                session,
                self.boss,
                MachineCreate(code="PRE-1", name="P", type="T", location="L", criticality="alta"),
            ).id
            self.incident = self.report(session)

    def report(self, session: Session) -> int:
        data = IncidentCreate(
            machine_id=self.machine,
            detected_at=datetime.now(UTC) - timedelta(hours=1),
            title="Fuga",
            symptom="Charco",
            failure_type="hidraulico",
            priority="alta",
            machine_stopped=True,
        )
        return incidents.create_incident(session, self.boss, data).id

    def status(self) -> str:
        with Session(self.engine) as session:
            return str(incidents.get_incident(session, self.incident).status)


def _dos_asignaciones_simultaneas_de_la_misma_averia(api_engine: Engine) -> None:
    flow = Flow(api_engine)
    results = run_concurrently(
        api_engine,
        lambda s: incidents.assign(
            s, flow.boss, flow.incident, AssignInput(technician_id=flow.tech)
        ),
        lambda s: incidents.assign(
            s, flow.boss2, flow.incident, AssignInput(technician_id=flow.tech2)
        ),
    )
    conflicts = [r for r in results if isinstance(r, ConflictError)]
    assert len(conflicts) == 1, results
    assert conflicts[0].code == "incident_invalid_transition"
    winner = next(r for r in results if isinstance(r, IncidentDetail))
    with Session(api_engine) as session:
        stored = incidents.get_incident(session, flow.incident)
    assert stored.assigned_technician == winner.assigned_technician


def test_dos_asignaciones_simultaneas_de_la_misma_averia(api_engine: Engine) -> None:
    for _ in range(3):
        _dos_asignaciones_simultaneas_de_la_misma_averia(api_engine)


def _asignacion_y_baja_del_tecnico_simultaneas(api_engine: Engine) -> None:
    flow = Flow(api_engine)
    results = run_concurrently(
        api_engine,
        lambda s: incidents.assign(
            s, flow.boss, flow.incident, AssignInput(technician_id=flow.tech)
        ),
        lambda s: people.retire_person(s, flow.boss2, flow.tech),
    )
    errors = [r for r in results if isinstance(r, DomainError)]
    assert len(errors) == 1, results
    assert errors[0].code in {"technician_inactive", "technician_has_open_incidents"}
    with Session(api_engine) as session:
        tech_active = people.get_person(session, flow.tech).active
    assert (flow.status() == "asignada") == tech_active


def test_asignacion_y_baja_del_tecnico_simultaneas(api_engine: Engine) -> None:
    """Gana una de las dos; nunca queda una avería asignada a un técnico inactivo."""
    for _ in range(5):
        _asignacion_y_baja_del_tecnico_simultaneas(api_engine)


def _registro_y_baja_de_maquina_simultaneos(api_engine: Engine) -> None:
    flow = Flow(api_engine)
    with Session(api_engine, expire_on_commit=False) as session:
        incidents.assign(session, flow.boss, flow.incident, AssignInput(technician_id=flow.tech))
        incidents.start(session, flow.tech, flow.incident)
        incidents.resolve(
            session, flow.tech, flow.incident, ResolveInput(root_cause="a", solution="b")
        )
        incidents.close(session, flow.boss, flow.incident)
    results = run_concurrently(
        api_engine,
        flow.report,
        lambda s: machines.retire_machine(s, flow.boss2, flow.machine),
    )
    errors = [r for r in results if isinstance(r, DomainError)]
    assert len(errors) == 1, results
    assert errors[0].code in {"machine_retired", "machine_has_open_incidents"}


def test_registro_y_baja_de_maquina_simultaneos(api_engine: Engine) -> None:
    """O se registra la avería y la máquina sigue activa, o se da de baja y se rechaza."""
    for _ in range(5):
        _registro_y_baja_de_maquina_simultaneos(api_engine)


def _resolucion_e_imputacion_simultaneas(api_engine: Engine) -> None:
    flow = Flow(api_engine)
    with Session(api_engine, expire_on_commit=False) as session:
        incidents.assign(session, flow.boss, flow.incident, AssignInput(technician_id=flow.tech))
        incidents.start(session, flow.tech, flow.incident)
    log = WorkLogCreate(work_date=datetime.now(UTC).date(), hours="1", description="Ayuda")
    results = run_concurrently(
        api_engine,
        lambda s: incidents.resolve(
            s, flow.tech, flow.incident, ResolveInput(root_cause="a", solution="b")
        ),
        lambda s: incidents.add_work_log(s, flow.tech2, flow.incident, log),
        lambda s: incidents.resolve(
            s, flow.tech, flow.incident, ResolveInput(root_cause="c", solution="d")
        ),
    )
    resolutions = [r for r in (results[0], results[2]) if isinstance(r, IncidentDetail)]
    assert len(resolutions) == 1, results
    logged = isinstance(results[1], WorkLogOut)
    if not logged:
        assert isinstance(results[1], ConflictError)
        assert results[1].code == "incident_not_in_progress"
    with Session(api_engine) as session:
        stored = incidents.get_incident(session, flow.incident)
    assert stored.status == "resuelta"
    assert stored.worked_minutes == (60 if logged else 0)


def test_resolucion_e_imputacion_simultaneas(api_engine: Engine) -> None:
    """La imputación entra antes de resolver o se rechaza; nunca queda en una resuelta."""
    for _ in range(5):
        _resolucion_e_imputacion_simultaneas(api_engine)
