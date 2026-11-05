"""Histórico de conocimiento: solo resueltas y cerradas, filtros combinados y búsqueda parcial."""

from typing import Any

from fastapi.testclient import TestClient

from tests.factories import API, actor, create_machine
from tests.flow import Team


def history(client: TestClient, **params: Any) -> dict[str, Any]:
    response = client.get(f"{API}/incidents/history", params=params)
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()
    return data


def numbers(data: dict[str, Any]) -> list[str]:
    return [item["number"] for item in data["items"]]


def documented(team: Team, machine: int, title: str, symptom: str, cause: str, fix: str) -> Any:
    incident = team.in_progress(machine_id=machine, title=title, symptom=symptom)
    return team.ok(incident, "resolve", team.tech, {"root_cause": cause, "solution": fix})


def test_solo_resueltas_y_cerradas_por_resolucion_descendente(team: Team) -> None:
    client = team.client
    first = documented(team, team.machine, "Fuga", "Charco", "Junta", "Cambio de junta")
    second = documented(team, team.machine, "Ruido", "Golpeteo", "Rodamiento", "Sustituir")
    team.ok(first["id"], "close", team.boss)
    team.report(title="Abierta sin documentar")
    team.in_progress(title="En curso sin documentar")

    data = history(client)
    assert data["total"] == 2
    assert numbers(data) == [second["number"], first["number"]]
    item = data["items"][1]
    assert item["status"] == "cerrada"
    assert item["machine"]["code"] == "PRE-004"
    assert item["symptom"] == "Charco"
    assert item["root_cause"] == "Junta"
    assert item["solution"] == "Cambio de junta"
    assert item["closed_at"] is not None


def test_busca_por_maquina_sintoma_causa_y_texto_parcial(team: Team) -> None:
    client = team.client
    other = create_machine(client, team.boss, code="CNC-002", name="Centro de mecanizado")["id"]
    leak = documented(
        team,
        team.machine,
        "Pérdida de presión",
        "Fuga de aceite en el cilindro",
        "Junta tórica cristalizada",
        "Sustitución de la junta tórica y purga del circuito",
    )
    spindle = documented(
        team,
        other,
        "Vibración del husillo",
        "Vibraciones al superar 8000 rpm",
        "Rodamiento del husillo dañado",
        "Cambio de rodamientos y equilibrado",
    )

    assert numbers(history(client, machine_id=other)) == [spindle["number"]]
    assert numbers(history(client, symptom="FUGA DE")) == [leak["number"]]
    assert numbers(history(client, root_cause="rodamiento")) == [spindle["number"]]
    # Texto parcial de la solución, código y nombre de máquina, sin distinguir mayúsculas.
    assert numbers(history(client, q="purga")) == [leak["number"]]
    assert numbers(history(client, q="cnc-0")) == [spindle["number"]]
    assert numbers(history(client, q="mecanizado")) == [spindle["number"]]
    assert numbers(history(client, q="husillo")) == [spindle["number"]]
    # Los filtros se combinan con AND.
    assert numbers(history(client, q="junta", machine_id=other)) == []
    assert numbers(history(client, q="junta", root_cause="tórica")) == [leak["number"]]
    # Vacíos o solo espacios no filtran.
    assert history(client, q="   ", symptom="")["total"] == 2


def test_comodines_del_usuario_se_buscan_literalmente(team: Team) -> None:
    client = team.client
    documented(team, team.machine, "Ajuste", "Holgura", "Desgaste", "Ajuste al 50% de presión")
    documented(team, team.machine, "Otro", "Ruido", "Suciedad", "Limpieza general")

    assert history(client, q="%")["total"] == 1
    assert history(client, q="_")["total"] == 0
    assert history(client, q="'; DROP TABLE incidents; --")["total"] == 0
    assert history(client)["total"] == 2


def test_incluye_maquinas_de_baja_y_valida_parametros(team: Team) -> None:
    client = team.client
    resolved = documented(team, team.machine, "Fuga", "Charco", "Junta", "Cambio de junta")
    team.ok(resolved["id"], "close", team.boss)
    retired = client.delete(f"{API}/machines/{team.machine}", headers=actor(team.boss))
    assert retired.status_code == 204

    data = history(client, q="junta")
    assert numbers(data) == [resolved["number"]]
    assert data["items"][0]["machine"]["status"] == "de_baja"

    assert client.get(f"{API}/incidents/history", params={"machine_id": 0}).status_code == 422
    too_long = client.get(f"{API}/incidents/history", params={"q": "x" * 201})
    assert too_long.status_code == 422
    paged = history(client, page=2, page_size=1)
    assert (paged["total"], paged["items"]) == (1, [])
