"""Ayudas para preparar datos en las pruebas de API."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

API = "/api/v1"


def actor(person_id: int) -> dict[str, str]:
    return {"X-Actor-Id": str(person_id)}


def bootstrap_responsable(client: TestClient, name: str = "Rosa Responsable") -> int:
    response = client.post(f"{API}/people", json={"full_name": name, "role": "responsable"})
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def create_person(client: TestClient, by: int, **overrides: Any) -> dict[str, Any]:
    body = {"full_name": "Tomás Técnico", "role": "tecnico", "specialty": "mecanica"} | overrides
    response = client.post(f"{API}/people", json=body, headers=actor(by))
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


def create_machine(client: TestClient, by: int, **overrides: Any) -> dict[str, Any]:
    body = {
        "code": "PRE-004",
        "name": "Prensa hidráulica 4",
        "type": "Prensa",
        "location": "Nave 1",
        "criticality": "alta",
    } | overrides
    response = client.post(f"{API}/machines", json=body, headers=actor(by))
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


_sequence = iter(range(1, 10_000))


def insert_incident(
    engine: Engine,
    machine_id: int,
    reporter_id: int,
    *,
    status: str = "abierta",
    stopped: bool = True,
    technician_id: int | None = None,
    closer_id: int | None = None,
) -> int:
    """Inserta una avería directamente en SQL (el flujo por API llega en la Fase 3)."""
    values: dict[str, Any] = {
        "number": f"AV-2026-{next(_sequence):04d}",
        "machine_id": machine_id,
        "reported_by_id": reporter_id,
        "detected_at": "2026-11-01T08:00:00+00:00",
        "title": "Fuga de aceite",
        "symptom": "Charco bajo el cilindro",
        "failure_type": "hidraulico",
        "priority": "alta",
        "machine_stopped": stopped,
        "status": status,
        "assigned_technician_id": technician_id if status != "abierta" else None,
    }
    if status in {"resuelta", "cerrada"}:
        values |= {
            "resolved_at": "2026-11-01T10:00:00+00:00",
            "root_cause": "Junta desgastada",
            "solution": "Cambio de junta",
        }
    if status == "cerrada":
        values |= {"closed_at": "2026-11-01T11:00:00+00:00", "closed_by_id": closer_id}
    columns = ", ".join(values)
    params = ", ".join(f":{key}" for key in values)
    with engine.begin() as connection:
        return int(
            connection.execute(
                text(f"INSERT INTO incidents ({columns}) VALUES ({params}) RETURNING id"), values
            ).scalar_one()
        )


def set_incident_status(engine: Engine, incident_id: int, status: str, closer_id: int) -> None:
    """Lleva una avería a resuelta o cerrada con los datos que exige el esquema."""
    closed = status == "cerrada"
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE incidents SET status = :status, resolved_at = :resolved, "
                "root_cause = 'Junta', solution = 'Cambio de junta', "
                "closed_at = :closed_at, closed_by_id = :closer WHERE id = :id"
            ),
            {
                "status": status,
                "resolved": "2026-11-01T10:00:00+00:00",
                "closed_at": "2026-11-01T11:00:00+00:00" if closed else None,
                "closer": closer_id if closed else None,
                "id": incident_id,
            },
        )


def insert_work_log(engine: Engine, incident_id: int, technician_id: int, minutes: int) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO work_logs (incident_id, technician_id, work_date, minutes, "
                "description) VALUES (:incident, :tech, '2026-11-01', :minutes, 'Revisión')"
            ),
            {"incident": incident_id, "tech": technician_id, "minutes": minutes},
        )
