"""Carga demo: idempotente, coherente con las reglas y útil para los criterios de aceptación."""

from collections import Counter
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.models import Incident, Machine, Person, WorkLog
from scripts.seed_demo import seed
from tests.factories import API, actor, bootstrap_responsable, create_machine


def load(engine: Engine) -> None:
    with Session(engine) as session:
        seed(session)
        session.commit()


def counts(engine: Engine) -> tuple[int, ...]:
    with Session(engine) as session:
        return tuple(
            session.scalar(select(func.count()).select_from(model)) or 0
            for model in (Machine, Person, Incident, WorkLog)
        )


def get(client: TestClient, path: str, **params: Any) -> Any:
    response = client.get(f"{API}{path}", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def by_code(client: TestClient, code: str) -> dict[str, Any]:
    items = get(client, "/machines", page_size=100)["items"]
    return next(item for item in items if item["code"] == code)


def test_dos_cargas_dejan_la_base_igual(client: TestClient, api_engine: Engine) -> None:
    load(api_engine)
    first = counts(api_engine)
    assert first == (6, 7, 12, 9)
    load(api_engine)
    assert counts(api_engine) == first


def test_cubre_los_cinco_estados_y_la_imputacion_de_dos_tecnicos(
    client: TestClient, api_engine: Engine
) -> None:
    load(api_engine)
    incidents = get(client, "/incidents", page_size=100)["items"]
    assert Counter(item["status"] for item in incidents) == {
        "abierta": 2,
        "asignada": 2,
        "en_curso": 2,
        "resuelta": 2,
        "cerrada": 4,
    }
    # Numeración del servidor en orden cronológico de detección.
    oldest_first = sorted(incidents, key=lambda item: item["detected_at"])
    assert [item["number"] for item in oldest_first] == sorted(item["number"] for item in incidents)

    shared = next(item for item in incidents if item["title"].startswith("Pérdida de presión"))
    assert shared["worked_minutes"] == 120
    logs = get(client, f"/incidents/{shared['id']}/work-logs")["items"]
    assert sorted((log["technician"]["full_name"], log["minutes"]) for log in logs) == [
        ("Hugo Ruiz Navarro", 45),
        ("Tomás García León", 75),
    ]


def test_estados_de_maquina_bajas_y_buscador(client: TestClient, api_engine: Engine) -> None:
    load(api_engine)
    # PRE-001 tiene dos averías abiertas con parada.
    assert by_code(client, "PRE-001")["status"] == "en_averia"
    assert by_code(client, "CIN-004")["status"] == "operativa"
    retired = by_code(client, "HOR-006")
    assert retired["status"] == "de_baja"
    assert get(client, "/incidents", machine_id=retired["id"])["total"] == 2

    inactive = get(client, "/people", active="false")["items"]
    assert [person["full_name"] for person in inactive] == ["Inés Moreno Cano"]
    detail = get(client, f"/people/{inactive[0]['id']}")
    assert detail["worked_minutes"] == 330
    assert detail["open_assignments"] == 0

    found = get(client, "/incidents/history", q="junta tórica")["items"]
    assert [item["machine"]["code"] for item in found] == ["PRE-001"]
    assert "purga del circuito" in found[0]["solution"]
    assert get(client, "/incidents/history", q="purga")["total"] == 1
    # El histórico incluye la máquina de baja y solo resueltas y cerradas.
    history = get(client, "/incidents/history", page_size=100)
    assert history["total"] == 6
    assert {item["status"] for item in history["items"]} == {"resuelta", "cerrada"}
    assert get(client, "/incidents/history", machine_id=retired["id"])["total"] == 2


def test_los_datos_demo_siguen_las_reglas_del_flujo(client: TestClient, api_engine: Engine) -> None:
    load(api_engine)
    people = {p["full_name"]: p["id"] for p in get(client, "/people", page_size=100)["items"]}
    incidents = get(client, "/incidents", page_size=100)["items"]
    opened = next(item for item in incidents if item["status"] == "abierta")
    in_progress = next(item for item in incidents if item["status"] == "en_curso")
    boss = people["Rosa Martín Vidal"]

    # Asignar a la técnica inactiva se rechaza; a un técnico activo funciona.
    inactive = client.post(
        f"{API}/incidents/{opened['id']}/assign",
        json={"technician_id": people["Inés Moreno Cano"]},
        headers=actor(boss),
    )
    assert inactive.status_code == 409
    assigned = client.post(
        f"{API}/incidents/{opened['id']}/assign",
        json={"technician_id": people["Teresa López Gil"]},
        headers=actor(boss),
    )
    assert assigned.status_code == 200, assigned.text
    # Un técnico colaborador imputa hoy en una avería en curso de la demo.
    logged = client.post(
        f"{API}/incidents/{in_progress['id']}/work-logs",
        json={
            "work_date": in_progress["detected_at"][:10],
            "hours": "0.25",
            "description": "Apoyo",
        },
        headers=actor(people["Teresa López Gil"]),
    )
    assert logged.status_code == 201, logged.text


def test_convive_con_datos_previos(client: TestClient, api_engine: Engine) -> None:
    boss = bootstrap_responsable(client, "Responsable propio")
    create_machine(client, boss, code="PRE-001", name="Prensa propia")
    load(api_engine)
    # La máquina existente no se modifica y recibe las averías demo de su código.
    assert by_code(client, "PRE-001")["name"] == "Prensa propia"
    assert counts(api_engine) == (6, 8, 12, 9)
    load(api_engine)
    assert counts(api_engine) == (6, 8, 12, 9)
