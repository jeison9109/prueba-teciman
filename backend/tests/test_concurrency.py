"""Escrituras concurrentes sobre invariantes que dependen de otras filas."""

import threading
from collections.abc import Callable
from functools import partial

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.errors import ConflictError, DomainError
from app.schemas.machine import MachineCreate
from app.schemas.person import PersonCreate
from app.services import machines, people


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
