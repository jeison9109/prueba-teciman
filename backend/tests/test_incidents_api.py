"""Flujo de averías por API: registro, ciclo de vida, imputaciones y acciones prohibidas."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.factories import API, actor, create_machine, create_person
from tests.flow import MADRID, Team, iso, local_day


def test_recorrido_completo_con_dos_tecnicos(team: Team) -> None:
    client = team.client
    created = team.report()
    incident = created["id"]
    year = datetime.now(UTC).astimezone(MADRID).year
    assert created["number"] == f"AV-{year}-0001"
    assert created["status"] == "abierta"
    assert created["reported_by"]["id"] == team.operator
    assert created["assigned_technician"] is None
    assert created["downtime_hours"] is None
    assert team.machine_status() == "en_averia"

    assigned = team.ok(incident, "assign", team.boss, {"technician_id": team.tech})
    assert assigned["status"] == "asignada"
    assert assigned["assigned_technician"] == {"id": team.tech, "full_name": "Tomás Técnico"}
    assert team.ok(incident, "start", team.tech)["status"] == "en_curso"

    assert team.log(incident, team.tech, "1.25").status_code == 201
    collaboration = team.log(incident, team.tech2, "0,75", description="Apoyo eléctrico")
    assert collaboration.status_code == 201, collaboration.text
    assert collaboration.json()["minutes"] == 45
    assert collaboration.json()["technician"]["id"] == team.tech2

    resolved = team.ok(
        incident,
        "resolve",
        team.tech,
        {
            "root_cause": "  Junta del cilindro desgastada ",
            "solution": "Sustitución de la junta",
            "replaced_parts": "JNT-45 x1",
            "solution_type": "sustitucion",
            "preventive_recommendation": "",
        },
    )
    assert resolved["status"] == "resuelta"
    assert resolved["root_cause"] == "Junta del cilindro desgastada"
    assert resolved["preventive_recommendation"] is None
    assert resolved["resolved_at"] is not None
    assert resolved["downtime_hours"] == pytest.approx(3, abs=0.02)
    assert team.machine_status() == "operativa"

    closed = team.ok(incident, "close", team.boss)
    assert closed["status"] == "cerrada"
    assert closed["closed_by"]["id"] == team.boss
    assert closed["closed_at"] >= closed["resolved_at"]
    assert closed["worked_minutes"] == 120

    logs = client.get(f"{API}/incidents/{incident}/work-logs").json()
    assert logs["total"] == 2
    assert [item["minutes"] for item in logs["items"]] == [75, 45]
    assert client.get(f"{API}/machines/{team.machine}").json()["worked_minutes"] == 120
    assert client.get(f"{API}/people/{team.tech}").json()["worked_minutes"] == 75
    assert client.get(f"{API}/people/{team.tech2}").json()["worked_minutes"] == 45


def test_sin_parada_el_tiempo_de_parada_es_cero(team: Team) -> None:
    incident = team.report(machine_stopped=False)
    assert incident["downtime_hours"] == 0
    assert team.machine_status() == "operativa"


def test_numeracion_correlativa(team: Team) -> None:
    year = datetime.now(UTC).astimezone(MADRID).year
    numbers = [team.report()["number"] for _ in range(2)]
    assert numbers == [f"AV-{year}-0001", f"AV-{year}-0002"]


@pytest.mark.parametrize("role", ["operario", "tecnico", "responsable"])
def test_cualquier_persona_activa_registra(client: TestClient, role: str) -> None:
    team = Team(client)
    person = create_person(client, team.boss, full_name="Otra persona", role=role)["id"]
    assert team.report(by=person)["reported_by"]["id"] == person


def test_registro_valida_actor_maquina_y_datos(team: Team) -> None:
    client = team.client
    base = {
        "machine_id": team.machine,
        "detected_at": iso(-timedelta(minutes=5)),
        "title": "Ruido",
        "symptom": "Golpeteo",
        "failure_type": "mecanico",
        "priority": "media",
        "machine_stopped": False,
    }
    no_actor = client.post(f"{API}/incidents", json=base)
    assert no_actor.status_code == 403
    assert no_actor.json()["code"] == "actor_required"

    future = client.post(
        f"{API}/incidents",
        json=base | {"detected_at": iso(timedelta(hours=1))},
        headers=actor(team.operator),
    )
    assert future.status_code == 422
    assert future.json()["fields"][0]["field"] == "detected_at"

    missing = client.post(
        f"{API}/incidents",
        json={k: v for k, v in base.items() if k != "machine_stopped"} | {"title": "   "},
        headers=actor(team.operator),
    )
    assert missing.status_code == 422
    assert {f["field"] for f in missing.json()["fields"]} == {"title", "machine_stopped"}

    unknown = client.post(
        f"{API}/incidents", json=base | {"machine_id": 999}, headers=actor(team.operator)
    )
    assert unknown.status_code == 422
    assert unknown.json()["code"] == "machine_not_found"

    long_title = client.post(
        f"{API}/incidents", json=base | {"title": "x" * 161}, headers=actor(team.operator)
    )
    assert long_title.status_code == 422


def test_deteccion_sin_zona_se_interpreta_en_la_zona_de_operacion(team: Team) -> None:
    naive = (datetime.now(MADRID) - timedelta(hours=1)).replace(tzinfo=None, microsecond=0)
    created = team.report(detected_at=naive.isoformat())
    stored = datetime.fromisoformat(created["detected_at"])
    assert stored == naive.replace(tzinfo=MADRID)


def test_no_se_registra_en_maquina_de_baja(team: Team) -> None:
    other = create_machine(team.client, team.boss, code="CNC-1")["id"]
    assert (
        team.client.delete(f"{API}/machines/{other}", headers=actor(team.boss)).status_code == 204
    )
    response = team.client.post(
        f"{API}/incidents",
        json={
            "machine_id": other,
            "detected_at": iso(-timedelta(hours=1)),
            "title": "Ruido",
            "symptom": "Golpeteo",
            "failure_type": "mecanico",
            "priority": "media",
            "machine_stopped": False,
        },
        headers=actor(team.operator),
    )
    assert response.status_code == 409
    assert response.json()["code"] == "machine_retired"


def test_se_rechazan_saltos_de_estado(team: Team) -> None:
    incident = team.report()["id"]
    cases = [
        ("start", team.tech, None),
        ("resolve", team.tech, {"root_cause": "a", "solution": "b"}),
        ("close", team.boss, None),
        ("reassign", team.boss, {"technician_id": team.tech}),
    ]
    for action, by, body in cases:
        response = team.act(incident, action, by, body)
        assert response.status_code == 409, (action, response.text)
        assert response.json()["code"] == "incident_invalid_transition"

    team.ok(incident, "assign", team.boss, {"technician_id": team.tech})
    skip = team.act(incident, "resolve", team.tech, {"root_cause": "a", "solution": "b"})
    assert skip.status_code == 409
    again = team.act(incident, "assign", team.boss, {"technician_id": team.tech2})
    assert again.status_code == 409
    assert team.client.get(f"{API}/incidents/{incident}").json()["status"] == "asignada"


def test_permisos_por_rol_y_tecnico_asignado(team: Team) -> None:
    incident = team.report()["id"]
    by_operator = team.act(incident, "assign", team.operator, {"technician_id": team.tech})
    assert by_operator.status_code == 403
    assert by_operator.json()["code"] == "actor_role_forbidden"
    team.ok(incident, "assign", team.boss, {"technician_id": team.tech})

    other_tech = team.act(incident, "start", team.tech2)
    assert other_tech.status_code == 403
    assert other_tech.json()["code"] == "actor_not_assigned"
    assert team.act(incident, "start", team.boss).status_code == 403
    team.ok(incident, "start", team.tech)

    resolve_body = {"root_cause": "a", "solution": "b"}
    assert team.act(incident, "resolve", team.tech2, resolve_body).status_code == 403
    team.ok(incident, "resolve", team.tech, resolve_body)

    for by in (team.operator, team.tech):
        closing = team.act(incident, "close", by)
        assert closing.status_code == 403
        assert closing.json()["code"] == "actor_role_forbidden"
    team.ok(incident, "close", team.boss)


def test_asignacion_solo_a_tecnicos_activos(team: Team) -> None:
    incident = team.report()["id"]
    assert team.client.delete(f"{API}/people/{team.tech2}", headers=actor(team.boss)).status_code
    inactive = team.act(incident, "assign", team.boss, {"technician_id": team.tech2})
    assert inactive.status_code == 409
    assert inactive.json()["code"] == "technician_inactive"
    assert inactive.json()["fields"][0]["field"] == "technician_id"

    operator = team.act(incident, "assign", team.boss, {"technician_id": team.operator})
    assert operator.status_code == 422
    assert operator.json()["code"] == "not_a_technician"
    unknown = team.act(incident, "assign", team.boss, {"technician_id": 999})
    assert unknown.status_code == 422
    assert unknown.json()["code"] == "technician_not_found"


def test_actor_inactivo_no_escribe(team: Team) -> None:
    incident = team.in_progress()
    assert team.client.delete(f"{API}/people/{team.tech2}", headers=actor(team.boss)).status_code
    response = team.log(incident, team.tech2, "1")
    assert response.status_code == 403
    assert response.json()["code"] == "actor_inactive"


def test_resolucion_exige_causa_y_solucion(team: Team) -> None:
    incident = team.in_progress()
    response = team.act(incident, "resolve", team.tech, {"root_cause": "  ", "solution": ""})
    assert response.status_code == 422
    assert {f["field"] for f in response.json()["fields"]} == {"root_cause", "solution"}
    missing = team.act(incident, "resolve", team.tech, {"root_cause": "Junta"})
    assert missing.status_code == 422
    assert team.client.get(f"{API}/incidents/{incident}").json()["status"] == "en_curso"


@pytest.mark.parametrize(
    ("hours", "fragment"),
    [
        ("-1", "mayores que cero"),
        ("0", "mayores que cero"),
        ("0.10", "tramos de 0,25"),
        ("1.3", "tramos de 0,25"),
        ("25", "Máximo 24"),
        ("abc", "número decimal"),
        (1.25, "Formato no válido"),
    ],
)
def test_imputacion_rechaza_horas_no_validas(team: Team, hours: Any, fragment: str) -> None:
    incident = team.in_progress()
    response = team.log(incident, team.tech, hours)
    assert response.status_code == 422, response.text
    field = response.json()["fields"][0]
    assert field["field"] == "hours"
    assert fragment in field["message"]


def test_imputacion_valida_fechas_y_estado(team: Team) -> None:
    incident = team.in_progress(detected_at=iso(-timedelta(days=3)))
    before = team.log(incident, team.tech, "1", work_date=local_day(-timedelta(days=4)))
    assert before.status_code == 422
    assert before.json()["code"] == "work_date_before_detection"
    future = team.log(incident, team.tech, "1", work_date=local_day(timedelta(days=1)))
    assert future.status_code == 422
    assert future.json()["code"] == "work_date_in_future"
    on_detection_day = team.log(incident, team.tech, "1", work_date=local_day(-timedelta(days=3)))
    assert on_detection_day.status_code == 201
    blank = team.log(incident, team.tech, "1", description=" ")
    assert blank.status_code == 422

    by_boss = team.log(incident, team.boss, "1")
    assert by_boss.status_code == 403

    team.resolve(incident)
    after = team.log(incident, team.tech, "1")
    assert after.status_code == 409
    assert after.json()["code"] == "incident_not_in_progress"

    assigned = team.report()["id"]
    team.ok(assigned, "assign", team.boss, {"technician_id": team.tech})
    assert team.log(assigned, team.tech, "1").status_code == 409


def test_reasignar_conserva_estado_e_imputaciones(team: Team) -> None:
    incident = team.in_progress()
    assert team.log(incident, team.tech, "2").status_code == 201

    same = team.act(incident, "reassign", team.boss, {"technician_id": team.tech})
    assert same.status_code == 422
    assert same.json()["code"] == "same_technician"
    moved = team.ok(incident, "reassign", team.boss, {"technician_id": team.tech2})
    assert moved["status"] == "en_curso"
    assert moved["assigned_technician"]["id"] == team.tech2

    assert (
        team.act(incident, "resolve", team.tech, {"root_cause": "a", "solution": "b"}).status_code
        == 403
    )
    logs = team.client.get(f"{API}/incidents/{incident}/work-logs").json()["items"]
    assert [log["technician"]["id"] for log in logs] == [team.tech]
    # El técnico anterior queda libre para darse de baja; el nuevo no.
    assert team.client.get(f"{API}/people/{team.tech}").json()["open_assignments"] == 0
    blocked = team.client.delete(f"{API}/people/{team.tech2}", headers=actor(team.boss))
    assert blocked.status_code == 409
    team.resolve(incident, by=team.tech2)


def test_dos_paradas_simultaneas_y_condicion_administrativa(team: Team) -> None:
    first = team.in_progress()
    second = team.in_progress(title="Fallo eléctrico", failure_type="electrico")
    assert team.machine_status() == "en_averia"

    # Durante la parada se cambia la condición administrativa; el estado visible no cambia.
    patched = team.client.patch(
        f"{API}/machines/{team.machine}",
        json={"admin_status": "fuera_de_servicio"},
        headers=actor(team.boss),
    )
    assert patched.json()["status"] == "en_averia"

    team.resolve(first)
    assert team.machine_status() == "en_averia"
    stopped_filter = team.client.get(f"{API}/machines", params={"status": "en_averia"}).json()
    assert stopped_filter["total"] == 1
    detail = team.client.get(f"{API}/incidents/{second}").json()
    assert detail["machine"]["status"] == "en_averia"

    team.resolve(second)
    assert team.machine_status() == "fuera_de_servicio"


def test_bandeja_filtra_ordena_y_pagina(team: Team) -> None:
    client = team.client
    other = create_machine(client, team.boss, code="CNC-1")["id"]
    old = team.report(detected_at=iso(-timedelta(days=2)), priority="baja")["id"]
    recent = team.report(detected_at=iso(-timedelta(hours=1)), priority="urgente")["id"]
    on_other = team.report(machine_id=other, detected_at=iso(-timedelta(hours=2)))["id"]
    team.ok(recent, "assign", team.boss, {"technician_id": team.tech})

    everything = client.get(f"{API}/incidents").json()
    assert [item["id"] for item in everything["items"]] == [recent, on_other, old]
    assert everything["items"][0]["machine"]["code"] == "PRE-004"
    assert everything["items"][0]["assigned_technician"]["full_name"] == "Tomás Técnico"

    by_machine = client.get(f"{API}/incidents", params={"machine_id": team.machine}).json()
    assert [item["id"] for item in by_machine["items"]] == [recent, old]
    assert client.get(f"{API}/incidents", params={"status": "asignada"}).json()["total"] == 1
    assert client.get(f"{API}/incidents", params={"priority": "baja"}).json()["total"] == 1
    combined = client.get(
        f"{API}/incidents", params={"machine_id": team.machine, "priority": "urgente"}
    ).json()
    assert [item["id"] for item in combined["items"]] == [recent]

    paged = client.get(f"{API}/incidents", params={"page": 2, "page_size": 2}).json()
    assert paged["total"] == 3
    assert [item["id"] for item in paged["items"]] == [old]
    assert client.get(f"{API}/incidents", params={"status": "rota"}).status_code == 422


def test_rutas_inexistentes(team: Team) -> None:
    assert team.client.get(f"{API}/incidents/999").status_code == 404
    assert team.client.get(f"{API}/incidents/999/work-logs").status_code == 404
    missing = team.act(999, "start", team.tech)
    assert missing.status_code == 404
    assert missing.json()["code"] == "incident_not_found"


def test_baja_de_maquina_tras_cerrar_conserva_historial(team: Team) -> None:
    incident = team.in_progress()
    team.resolve(incident)
    blocked = team.client.delete(f"{API}/machines/{team.machine}", headers=actor(team.boss))
    assert blocked.status_code == 409
    team.ok(incident, "close", team.boss)
    assert (
        team.client.delete(f"{API}/machines/{team.machine}", headers=actor(team.boss)).status_code
        == 204
    )
    history = team.client.get(f"{API}/incidents", params={"machine_id": team.machine}).json()
    assert history["total"] == 1
    assert history["items"][0]["machine"]["status"] == "de_baja"
    assert team.client.get(f"{API}/incidents/{incident}").json()["solution"] == "Cambio de junta"


def test_config_publica_la_zona_de_operacion(client: TestClient) -> None:
    assert client.get(f"{API}/config").json() == {"operation_timezone": "Europe/Madrid"}
