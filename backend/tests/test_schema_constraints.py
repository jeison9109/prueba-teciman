"""Restricciones locales del esquema inicial (spec.md, «Modelo y validaciones»)."""

from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import IntegrityError


@pytest.fixture
def conn(engine: Engine) -> Iterator[Connection]:
    """Conexión dentro de una transacción que se deshace al terminar cada prueba."""
    with engine.connect() as connection:
        transaction = connection.begin()
        yield connection
        transaction.rollback()


def insert(conn: Connection, table: str, **values: Any) -> int:
    columns = ", ".join(values)
    params = ", ".join(f":{key}" for key in values)
    return int(
        conn.execute(
            text(f"INSERT INTO {table} ({columns}) VALUES ({params}) RETURNING id"), values
        ).scalar_one()
    )


def machine(conn: Connection, **overrides: Any) -> int:
    values = {
        "code": "PRE-004",
        "name": "Prensa 4",
        "type": "Prensa",
        "location": "Nave 1",
        "criticality": "alta",
    } | overrides
    return insert(conn, "machines", **values)


def person(conn: Connection, **overrides: Any) -> int:
    return insert(conn, "people", **({"full_name": "Ana Pérez", "role": "tecnico"} | overrides))


def incident(conn: Connection, machine_id: int, reporter_id: int, **overrides: Any) -> int:
    values = {
        "number": "AV-2026-0001",
        "machine_id": machine_id,
        "reported_by_id": reporter_id,
        "detected_at": "2026-11-05T08:00:00+00:00",
        "title": "Fuga de aceite",
        "symptom": "Charco bajo el cilindro principal",
        "failure_type": "hidraulico",
        "priority": "alta",
        "machine_stopped": True,
    } | overrides
    return insert(conn, "incidents", **values)


def assert_rejected(conn: Connection, constraint: str, action: Any) -> None:
    savepoint = conn.begin_nested()
    with pytest.raises(IntegrityError) as error:
        action()
    savepoint.rollback()
    assert constraint in str(error.value)


def test_codigo_de_maquina_unico_y_normalizado(conn: Connection) -> None:
    machine(conn)
    assert_rejected(conn, "uq_machines_code", lambda: machine(conn))
    assert_rejected(conn, "ck_machines_code_normalized", lambda: machine(conn, code=" pre-5"))
    assert_rejected(
        conn,
        "ck_machines_admin_status",
        lambda: machine(conn, code="X-1", admin_status="en_averia"),
    )


def test_persona_valida_email_coste_y_rol(conn: Connection) -> None:
    person(conn, email="ana@example.com", hourly_cost="35.50")
    assert_rejected(conn, "ck_people_email_format", lambda: person(conn, email="sin-arroba"))
    assert_rejected(
        conn, "ck_people_hourly_cost_non_negative", lambda: person(conn, hourly_cost="-1")
    )
    assert_rejected(conn, "ck_people_role", lambda: person(conn, role="jefe"))
    assert_rejected(conn, "ck_people_full_name_not_blank", lambda: person(conn, full_name="  "))


def test_averia_abierta_sin_tecnico_y_numero_con_formato(conn: Connection) -> None:
    machine_id, reporter_id = machine(conn), person(conn, role="operario")
    technician_id = person(conn)
    incident(conn, machine_id, reporter_id)
    assert_rejected(conn, "uq_incidents_number", lambda: incident(conn, machine_id, reporter_id))
    assert_rejected(
        conn,
        "ck_incidents_number_format",
        lambda: incident(conn, machine_id, reporter_id, number="AV-26-1"),
    )
    assert_rejected(
        conn,
        "ck_incidents_assignment_matches_status",
        lambda: incident(
            conn,
            machine_id,
            reporter_id,
            number="AV-2026-0002",
            assigned_technician_id=technician_id,
        ),
    )
    assert_rejected(
        conn,
        "ck_incidents_assignment_matches_status",
        lambda: incident(conn, machine_id, reporter_id, number="AV-2026-0003", status="asignada"),
    )


def test_resolver_exige_causa_y_solucion(conn: Connection) -> None:
    machine_id, technician_id = machine(conn), person(conn)
    resolved = {
        "status": "resuelta",
        "assigned_technician_id": technician_id,
        "resolved_at": "2026-11-05T10:00:00+00:00",
    }
    assert_rejected(
        conn,
        "ck_incidents_resolution_documented",
        lambda: incident(
            conn, machine_id, technician_id, **resolved, root_cause="   ", solution="Cambiar junta"
        ),
    )
    assert_rejected(
        conn,
        "ck_incidents_resolved_at_matches_status",
        lambda: incident(
            conn,
            machine_id,
            technician_id,
            status="en_curso",
            assigned_technician_id=technician_id,
            resolved_at="2026-11-05T10:00:00+00:00",
        ),
    )
    assert_rejected(
        conn,
        "ck_incidents_resolved_after_detection",
        lambda: incident(
            conn,
            machine_id,
            technician_id,
            **(resolved | {"resolved_at": "2026-11-04T10:00:00+00:00"}),
            root_cause="Junta gastada",
            solution="Cambiar junta",
        ),
    )
    incident(
        conn,
        machine_id,
        technician_id,
        **resolved,
        root_cause="Junta gastada",
        solution="Cambiar junta",
    )


def test_cerrar_exige_validador_y_hora(conn: Connection) -> None:
    machine_id, technician_id = machine(conn), person(conn)
    manager_id = person(conn, role="responsable")
    closed = {
        "status": "cerrada",
        "assigned_technician_id": technician_id,
        "resolved_at": "2026-11-05T10:00:00+00:00",
        "root_cause": "Junta gastada",
        "solution": "Cambiar junta",
    }
    assert_rejected(
        conn,
        "ck_incidents_closed_at_matches_status",
        lambda: incident(conn, machine_id, technician_id, **closed),
    )
    assert_rejected(
        conn,
        "ck_incidents_closure_has_validator",
        lambda: incident(
            conn, machine_id, technician_id, **closed, closed_at="2026-11-05T11:00:00+00:00"
        ),
    )
    incident(
        conn,
        machine_id,
        technician_id,
        **closed,
        closed_by_id=manager_id,
        closed_at="2026-11-05T11:00:00+00:00",
    )


@pytest.mark.parametrize("minutes", [0, -15, 6, 10])
def test_imputacion_en_tramos_de_cuarto_de_hora(conn: Connection, minutes: int) -> None:
    machine_id, technician_id = machine(conn), person(conn)
    incident_id = incident(
        conn, machine_id, technician_id, status="en_curso", assigned_technician_id=technician_id
    )
    log = {
        "incident_id": incident_id,
        "technician_id": technician_id,
        "work_date": "2026-11-05",
        "description": "Desmontaje",
    }
    insert(conn, "work_logs", **log, minutes=75)
    assert_rejected(
        conn,
        "ck_work_logs_minutes_quarter_hours",
        lambda: insert(conn, "work_logs", **log, minutes=minutes),
    )


def test_claves_foraneas_impiden_borrar_historial(conn: Connection) -> None:
    machine_id, reporter_id = machine(conn), person(conn, role="operario")
    incident(conn, machine_id, reporter_id)
    assert_rejected(
        conn,
        "fk_incidents_machine_id_machines",
        lambda: conn.execute(text("DELETE FROM machines WHERE id = :id"), {"id": machine_id}),
    )
