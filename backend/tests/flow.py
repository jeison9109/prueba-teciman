"""Equipo y acciones de avería por API reutilizados por las pruebas del flujo."""

from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from tests.factories import API, actor, bootstrap_responsable, create_machine, create_person

MADRID = ZoneInfo("Europe/Madrid")


def iso(delta: timedelta) -> str:
    return (datetime.now(UTC) + delta).isoformat()


def local_day(delta: timedelta = timedelta()) -> str:
    return (datetime.now(UTC) + delta).astimezone(MADRID).date().isoformat()


class Team:
    """Responsable, operario, dos técnicos y una máquina listos para el flujo."""

    def __init__(self, client: TestClient) -> None:
        self.client = client
        self.boss = bootstrap_responsable(client)
        self.operator = create_person(
            client, self.boss, full_name="Olga Operaria", role="operario"
        )["id"]
        self.tech = create_person(client, self.boss, full_name="Tomás Técnico")["id"]
        self.tech2 = create_person(client, self.boss, full_name="Teresa Técnica")["id"]
        self.machine = create_machine(client, self.boss)["id"]

    def report(self, by: int | None = None, **overrides: Any) -> dict[str, Any]:
        body = {
            "machine_id": self.machine,
            "detected_at": iso(-timedelta(hours=3)),
            "title": "Fuga de aceite",
            "symptom": "Charco bajo el cilindro principal",
            "failure_type": "hidraulico",
            "priority": "alta",
            "machine_stopped": True,
        } | overrides
        response = self.client.post(
            f"{API}/incidents", json=body, headers=actor(by or self.operator)
        )
        assert response.status_code == 201, response.text
        data: dict[str, Any] = response.json()
        return data

    def act(self, incident: int, action: str, by: int, body: dict[str, Any] | None = None) -> Any:
        return self.client.post(
            f"{API}/incidents/{incident}/{action}", json=body, headers=actor(by)
        )

    def ok(self, incident: int, action: str, by: int, body: dict[str, Any] | None = None) -> Any:
        response = self.act(incident, action, by, body)
        assert response.status_code == 200, response.text
        return response.json()

    def log(self, incident: int, by: int, hours: Any, **overrides: Any) -> Any:
        body = {"work_date": local_day(), "hours": hours, "description": "Revisión"} | overrides
        return self.client.post(
            f"{API}/incidents/{incident}/work-logs", json=body, headers=actor(by)
        )

    def in_progress(self, **overrides: Any) -> int:
        incident = int(self.report(**overrides)["id"])
        self.ok(incident, "assign", self.boss, {"technician_id": self.tech})
        self.ok(incident, "start", self.tech)
        return incident

    def resolve(self, incident: int, by: int | None = None) -> Any:
        return self.ok(
            incident,
            "resolve",
            by or self.tech,
            {"root_cause": "Junta desgastada", "solution": "Cambio de junta"},
        )

    def machine_status(self) -> str:
        return str(self.client.get(f"{API}/machines/{self.machine}").json()["status"])
