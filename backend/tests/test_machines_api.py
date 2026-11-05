"""Máquinas: permisos, validación, unicidad, filtros, estado efectivo y baja (Fase 2)."""

from fastapi.testclient import TestClient
from sqlalchemy import Engine

from tests.factories import (
    API,
    actor,
    bootstrap_responsable,
    create_machine,
    create_person,
    insert_incident,
    insert_work_log,
    set_incident_status,
)


def test_alta_normaliza_codigo_y_recorta_textos(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    machine = create_machine(client, boss, code="  pre-004 ", name="  Prensa 4  ")
    assert machine["code"] == "PRE-004"
    assert machine["name"] == "Prensa 4"
    assert machine["status"] == "operativa"
    assert machine["worked_minutes"] == 0


def test_codigo_duplicado_sin_distinguir_mayusculas_es_409(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    create_machine(client, boss, code="PRE-004")
    response = client.post(
        f"{API}/machines",
        headers=actor(boss),
        json={
            "code": "pre-004",
            "name": "Otra",
            "type": "Prensa",
            "location": "Nave 2",
            "criticality": "baja",
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "machine_code_taken"
    assert response.json()["fields"][0]["field"] == "code"

    other = create_machine(client, boss, code="CNC-001")
    response = client.patch(
        f"{API}/machines/{other['id']}", headers=actor(boss), json={"code": " pre-004"}
    )
    assert response.status_code == 409


def test_campos_obligatorios_vacios_o_con_espacios_son_422(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    response = client.post(
        f"{API}/machines",
        headers=actor(boss),
        json={"code": "  ", "name": " ", "type": "Prensa", "criticality": "urgente"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert {item["field"] for item in body["fields"]} == {"code", "name", "location", "criticality"}

    machine = create_machine(client, boss)
    response = client.patch(
        f"{API}/machines/{machine['id']}", headers=actor(boss), json={"location": None}
    )
    assert response.status_code == 422
    response = client.patch(
        f"{API}/machines/{machine['id']}", headers=actor(boss), json={"admin_status": "de_baja"}
    )
    assert response.status_code == 422


def test_solo_un_responsable_activo_gestiona_maquinas(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    tech = create_person(client, boss)["id"]
    operator = create_person(client, boss, full_name="Olga Operaria", role="operario")["id"]
    body = {"code": "X-1", "name": "X", "type": "T", "location": "L", "criticality": "media"}

    assert client.post(f"{API}/machines", json=body).json()["code"] == "actor_required"
    for person in (tech, operator):
        response = client.post(f"{API}/machines", json=body, headers=actor(person))
        assert response.status_code == 403
        assert response.json()["code"] == "actor_role_forbidden"
    assert client.post(f"{API}/machines", json=body, headers=actor(999)).status_code == 403
    assert client.post(f"{API}/machines", json=body, headers=actor_raw("abc")).status_code == 403

    other_boss = create_person(client, boss, full_name="Rafa", role="responsable")["id"]
    assert client.delete(f"{API}/people/{other_boss}", headers=actor(boss)).status_code == 204
    response = client.post(f"{API}/machines", json=body, headers=actor(other_boss))
    assert response.json()["code"] == "actor_inactive"
    # La lectura no requiere actor.
    assert client.get(f"{API}/machines").status_code == 200


def actor_raw(value: str) -> dict[str, str]:
    return {"X-Actor-Id": value}


def test_listado_paginado_filtrado_y_ordenado(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    create_machine(client, boss, code="PRE-002", type="Prensa", location="Nave 1")
    create_machine(client, boss, code="CNC-001", type="Centro CNC", location="Nave 2")
    create_machine(client, boss, code="PRE-001", type="Prensa", location="Nave 2")

    page = client.get(f"{API}/machines", params={"page_size": 2}).json()
    assert page["total"] == 3 and page["page"] == 1 and page["page_size"] == 2
    assert [m["code"] for m in page["items"]] == ["CNC-001", "PRE-001"]
    page = client.get(f"{API}/machines", params={"page_size": 2, "page": 2}).json()
    assert [m["code"] for m in page["items"]] == ["PRE-002"]

    filtered = client.get(f"{API}/machines", params={"type": "prensa", "location": "nave 2"})
    assert [m["code"] for m in filtered.json()["items"]] == ["PRE-001"]
    # Los comodines del usuario se tratan como texto.
    assert client.get(f"{API}/machines", params={"type": "%"}).json()["total"] == 0
    assert client.get(f"{API}/machines", params={"page_size": 101}).status_code == 422
    assert client.get(f"{API}/machines", params={"status": "rota"}).status_code == 422


def test_dos_paradas_simultaneas_y_condicion_administrativa(
    client: TestClient, api_engine: Engine
) -> None:
    boss = bootstrap_responsable(client)
    tech = create_person(client, boss)["id"]
    machine = create_machine(client, boss, admin_status="fuera_de_servicio")
    url = f"{API}/machines/{machine['id']}"

    first = insert_incident(api_engine, machine["id"], boss, status="asignada", technician_id=tech)
    second = insert_incident(api_engine, machine["id"], boss, status="en_curso", technician_id=tech)
    insert_incident(api_engine, machine["id"], boss, stopped=False)
    assert client.get(url).json()["status"] == "en_averia"
    stopped = client.get(f"{API}/machines", params={"status": "en_averia"}).json()
    assert [m["id"] for m in stopped["items"]] == [machine["id"]]

    # Durante la parada el responsable cambia la condición administrativa.
    response = client.patch(url, headers=actor(boss), json={"admin_status": "operativa"})
    assert response.json()["status"] == "en_averia"
    assert response.json()["admin_status"] == "operativa"

    set_incident_status(api_engine, first, "resuelta", boss)
    assert client.get(url).json()["status"] == "en_averia"
    set_incident_status(api_engine, second, "resuelta", boss)
    assert client.get(url).json()["status"] == "operativa"
    assert client.get(f"{API}/machines", params={"status": "en_averia"}).json()["total"] == 0


def test_baja_solo_con_averias_cerradas_y_conserva_historial(
    client: TestClient, api_engine: Engine
) -> None:
    boss = bootstrap_responsable(client)
    tech = create_person(client, boss)["id"]
    machine = create_machine(client, boss)
    url = f"{API}/machines/{machine['id']}"
    incident = insert_incident(
        api_engine, machine["id"], boss, status="en_curso", technician_id=tech
    )
    insert_work_log(api_engine, incident, tech, 75)
    insert_work_log(api_engine, incident, boss, 45)

    response = client.delete(url, headers=actor(boss))
    assert response.status_code == 409
    assert response.json()["code"] == "machine_has_open_incidents"

    set_incident_status(api_engine, incident, "resuelta", boss)
    assert client.delete(url, headers=actor(boss)).status_code == 409
    set_incident_status(api_engine, incident, "cerrada", boss)
    assert client.delete(url, headers=actor(tech)).status_code == 403

    response = client.delete(url, headers=actor(boss))
    assert response.status_code == 204
    assert response.content == b""
    assert client.delete(url, headers=actor(boss)).status_code == 204

    detail = client.get(url).json()
    assert detail["status"] == "de_baja"
    assert detail["worked_minutes"] == 120
    assert detail["open_incidents"] == 0
    listed = client.get(f"{API}/machines", params={"status": "de_baja"}).json()
    assert [m["id"] for m in listed["items"]] == [machine["id"]]
    response = client.patch(url, headers=actor(boss), json={"name": "Nuevo"})
    assert response.status_code == 409
    assert response.json()["code"] == "machine_retired"


def test_maquina_inexistente_es_404(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    assert client.get(f"{API}/machines/999").json()["code"] == "machine_not_found"
    assert client.patch(f"{API}/machines/999", headers=actor(boss), json={}).status_code == 404
    assert client.delete(f"{API}/machines/999", headers=actor(boss)).status_code == 404
