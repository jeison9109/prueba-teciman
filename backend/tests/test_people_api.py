"""Personas: alta inicial, validación, filtros, bajas y cambios de rol (Fase 2)."""

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


def test_alta_inicial_solo_con_base_vacia_y_rol_responsable(client: TestClient) -> None:
    response = client.post(f"{API}/people", json={"full_name": "Tomás", "role": "tecnico"})
    assert response.status_code == 422
    assert response.json()["code"] == "bootstrap_requires_responsable"

    boss = bootstrap_responsable(client)
    response = client.post(f"{API}/people", json={"full_name": "Otro", "role": "responsable"})
    assert response.status_code == 403
    assert response.json()["code"] == "actor_required"
    assert client.get(f"{API}/people").json()["total"] == 1
    assert client.get(f"{API}/people/{boss}").json()["role"] == "responsable"


def test_validacion_de_email_coste_y_textos(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    person = create_person(
        client,
        boss,
        full_name="  Ana  Pérez ",
        email=" Ana@Example.COM ",
        hourly_cost="35.5",
        phone=" +34 600 000 000 ",
    )
    assert person["full_name"] == "Ana  Pérez"
    assert person["email"] == "ana@example.com"
    assert person["hourly_cost"] == "35.50"
    assert person["phone"] == "+34 600 000 000"
    assert person["active"] is True

    response = client.post(
        f"{API}/people",
        headers=actor(boss),
        json={
            "full_name": "  ",
            "role": "jefe",
            "email": "sin-arroba",
            "hourly_cost": "-1",
            "specialty": "química",
        },
    )
    assert response.status_code == 422
    fields = {item["field"] for item in response.json()["fields"]}
    assert fields == {"full_name", "role", "email", "hourly_cost", "specialty"}
    response = client.post(
        f"{API}/people",
        headers=actor(boss),
        json={"full_name": "Coste", "role": "tecnico", "hourly_cost": "10.123"},
    )
    assert response.status_code == 422

    # Un opcional vacío se guarda como nulo; un obligatorio no se puede vaciar.
    url = f"{API}/people/{person['id']}"
    assert client.patch(url, headers=actor(boss), json={"email": ""}).json()["email"] is None
    assert client.patch(url, headers=actor(boss), json={"full_name": None}).status_code == 422
    assert client.patch(url, headers=actor(boss), json={"nickname": "x"}).status_code == 422


def test_filtros_por_rol_y_vigencia(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    create_person(client, boss, full_name="Berta")
    retired = create_person(client, boss, full_name="Alberto")["id"]
    create_person(client, boss, full_name="Óscar", role="operario", specialty=None)
    assert client.delete(f"{API}/people/{retired}", headers=actor(boss)).status_code == 204

    technicians = client.get(f"{API}/people", params={"role": "tecnico"}).json()
    assert [p["full_name"] for p in technicians["items"]] == ["Alberto", "Berta"]
    active = client.get(f"{API}/people", params={"role": "tecnico", "active": "true"}).json()
    assert [p["full_name"] for p in active["items"]] == ["Berta"]
    inactive = client.get(f"{API}/people", params={"active": "false"}).json()
    assert [p["id"] for p in inactive["items"]] == [retired]


def test_solo_un_responsable_activo_gestiona_personas(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    tech = create_person(client, boss)["id"]
    body = {"full_name": "Nadie", "role": "operario"}
    response = client.post(f"{API}/people", json=body, headers=actor(tech))
    assert response.status_code == 403
    assert client.patch(f"{API}/people/{tech}", json={"phone": "1"}).status_code == 403
    response = client.patch(f"{API}/people/{tech}", json={"phone": "1"}, headers=actor(tech))
    assert response.status_code == 403
    assert client.delete(f"{API}/people/{boss}", headers=actor(tech)).status_code == 403


def test_tecnico_con_averias_a_su_cargo_no_se_da_de_baja_ni_cambia_de_rol(
    client: TestClient, api_engine: Engine
) -> None:
    boss = bootstrap_responsable(client)
    tech = create_person(client, boss)["id"]
    machine = create_machine(client, boss)["id"]
    incident = insert_incident(api_engine, machine, boss, status="asignada", technician_id=tech)
    url = f"{API}/people/{tech}"

    for response in (
        client.delete(url, headers=actor(boss)),
        client.patch(url, headers=actor(boss), json={"active": False}),
        client.patch(url, headers=actor(boss), json={"role": "operario"}),
    ):
        assert response.status_code == 409
        assert response.json()["code"] == "technician_has_open_incidents"
    assert client.get(url).json()["open_assignments"] == 1
    # Otros cambios siguen permitidos.
    response = client.patch(url, headers=actor(boss), json={"specialty": "electrica"})
    assert response.status_code == 200

    set_incident_status(api_engine, incident, "resuelta", boss)
    assert client.delete(url, headers=actor(boss)).status_code == 204


def test_ultimo_responsable_activo_no_se_desactiva_ni_cambia_de_rol(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    url = f"{API}/people/{boss}"
    for response in (
        client.delete(url, headers=actor(boss)),
        client.patch(url, headers=actor(boss), json={"role": "tecnico"}),
        client.patch(url, headers=actor(boss), json={"active": False}),
    ):
        assert response.status_code == 409
        assert response.json()["code"] == "last_responsable"

    second = create_person(client, boss, full_name="Rafa", role="responsable")["id"]
    assert client.delete(url, headers=actor(second)).status_code == 204
    response = client.delete(f"{API}/people/{second}", headers=actor(second))
    assert response.json()["code"] == "last_responsable"
    # Reactivación por PATCH.
    response = client.patch(url, headers=actor(second), json={"active": True})
    assert response.status_code == 200 and response.json()["active"] is True


def test_baja_conserva_relaciones_y_horas(client: TestClient, api_engine: Engine) -> None:
    boss = bootstrap_responsable(client)
    tech = create_person(client, boss)["id"]
    machine = create_machine(client, boss)["id"]
    incident = insert_incident(api_engine, machine, tech, status="en_curso", technician_id=tech)
    insert_work_log(api_engine, incident, tech, 75)
    insert_work_log(api_engine, incident, tech, 45)
    set_incident_status(api_engine, incident, "cerrada", boss)

    assert client.delete(f"{API}/people/{tech}", headers=actor(boss)).status_code == 204
    detail = client.get(f"{API}/people/{tech}").json()
    assert detail["active"] is False
    assert detail["worked_minutes"] == 120
    assert client.get(f"{API}/machines/{machine}").json()["worked_minutes"] == 120
    # Una persona inactiva no puede escribir.
    response = client.post(
        f"{API}/machines",
        headers=actor(tech),
        json={"code": "N-1", "name": "N", "type": "T", "location": "L", "criticality": "baja"},
    )
    assert response.json()["code"] == "actor_inactive"


def test_persona_inexistente_es_404(client: TestClient) -> None:
    boss = bootstrap_responsable(client)
    assert client.get(f"{API}/people/999").json()["code"] == "person_not_found"
    assert client.patch(f"{API}/people/999", headers=actor(boss), json={}).status_code == 404
    assert client.delete(f"{API}/people/999", headers=actor(boss)).status_code == 404
