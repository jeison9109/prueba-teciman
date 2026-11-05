"""Recorrido completo de la demo contra una API en marcha (criterios de aceptación).

Uso, con la base migrada y los datos demo cargados (`make seed`):

    docker compose exec backend python -m scripts.walkthrough
    cd backend && uv run python -m scripts.walkthrough --api http://localhost:8000/api/v1

Actúa como las personas demo: crea una máquina propia (código `REC-<marca de tiempo>`), un
operario reporta una parada, un responsable asigna, el técnico inicia, dos técnicos imputan
1,25 h y 0,75 h, el asignado resuelve y un responsable cierra. Comprueba los rechazos de la
spec, los totales de avería, máquina y técnicos y la búsqueda en el histórico. Escribe datos
en la base indicada; `scripts/verify-stack.sh` lo ejecuta en un proyecto temporal.

Solo usa la biblioteca estándar para poder ejecutarse en la imagen del backend.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

DEMO_DOMAIN = "demo.teciman.local"


class StepFailed(Exception):
    pass


class Api:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")

    def call(
        self, method: str, path: str, body: Any = None, actor: int | None = None
    ) -> tuple[int, Any]:
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(f"{self.base}{path}", data=data, method=method)
        request.add_header("Accept", "application/json")
        if data is not None:
            request.add_header("Content-Type", "application/json")
        if actor is not None:
            request.add_header("X-Actor-Id", str(actor))
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read()
            return error.code, json.loads(raw) if raw else None

    def expect(
        self,
        status: int,
        method: str,
        path: str,
        body: Any = None,
        actor: int | None = None,
    ) -> Any:
        code, payload = self.call(method, path, body, actor)
        if code != status:
            raise StepFailed(f"{method} {path}: se esperaba {status} y llegó {code}: {payload}")
        return payload

    def get(self, path: str) -> Any:
        return self.expect(200, "GET", path)


def step(message: str) -> None:
    print(f"  ✓ {message}")


def check(condition: bool, message: str) -> None:
    if not condition:
        raise StepFailed(message)


def demo_people(api: Api) -> dict[str, int]:
    people = api.get("/people?page_size=100")["items"]
    found = {
        person["email"].split("@")[0]: person["id"]
        for person in people
        if (person["email"] or "").endswith(f"@{DEMO_DOMAIN}")
    }
    needed = {"rosa.martin", "olga.perez", "tomas.garcia", "hugo.ruiz", "ines.moreno"}
    missing = needed - found.keys()
    check(not missing, f"Faltan personas demo {sorted(missing)}: ejecuta antes `make seed`")
    return found


def run(api: Api) -> None:
    health = api.get("/health")
    check(health["status"] == "ok", f"La API no está sana: {health}")
    zone = ZoneInfo(api.get("/config")["operation_timezone"])
    today = datetime.now(UTC).astimezone(zone).date()
    step(f"API sana (migración {health['migration']}, zona {zone.key})")

    people = demo_people(api)
    boss, operator = people["rosa.martin"], people["olga.perez"]
    tomas, hugo, ines = people["tomas.garcia"], people["hugo.ruiz"], people["ines.moreno"]
    before = {tech: api.get(f"/people/{tech}")["worked_minutes"] for tech in (tomas, hugo)}

    code = f"REC-{int(time.time())}"
    machine = api.expect(
        201,
        "POST",
        "/machines",
        {
            "code": code,
            "name": "Máquina del recorrido",
            "type": "Prensa",
            "location": "Nave de pruebas",
            "criticality": "alta",
        },
        boss,
    )
    machine_id = machine["id"]
    step(f"Responsable crea la máquina {code}")

    detected = (datetime.now(UTC) - timedelta(hours=2)).isoformat()
    incident = api.expect(
        201,
        "POST",
        "/incidents",
        {
            "machine_id": machine_id,
            "detected_at": detected,
            "title": "Recorrido: fuga en el grupo hidráulico",
            "symptom": f"Recorrido {code}: charco de aceite bajo el grupo hidráulico",
            "failure_type": "hidraulico",
            "priority": "urgente",
            "machine_stopped": True,
        },
        operator,
    )
    path = f"/incidents/{incident['id']}"
    check(incident["status"] == "abierta", "La avería no queda abierta")
    check(api.get(f"/machines/{machine_id}")["status"] == "en_averia", "La máquina no está parada")
    step(f"Operario reporta la parada {incident['number']} y la máquina pasa a «en avería»")

    api.expect(409, "POST", f"{path}/start", actor=tomas)
    api.expect(403, "POST", f"{path}/close", actor=operator)
    api.expect(409, "POST", f"{path}/assign", {"technician_id": ines}, boss)
    step("Rechazados: salto de estado, cierre por operario y asignación a técnica inactiva")

    api.expect(200, "POST", f"{path}/assign", {"technician_id": tomas}, boss)
    api.expect(200, "POST", f"{path}/start", actor=tomas)
    step("Responsable asigna a Tomás y Tomás inicia")

    def log(tech: int, hours: str, work_date: str = today.isoformat()) -> tuple[int, Any]:
        body = {"work_date": work_date, "hours": hours, "description": "Trabajo del recorrido"}
        return api.call("POST", f"{path}/work-logs", body, tech)

    yesterday_of_detection = (datetime.fromisoformat(detected).astimezone(zone).date()) - timedelta(
        days=1
    )
    for hours, work_date in (
        ("-1", today.isoformat()),
        ("0", today.isoformat()),
        ("0.10", today.isoformat()),
        ("1", yesterday_of_detection.isoformat()),
    ):
        code_, _ = log(tomas, hours, work_date)
        check(code_ == 422, f"Imputación {hours} h del {work_date} aceptada ({code_})")
    step("Rechazadas imputaciones negativa, cero, de 0,10 h y anterior a la detección")

    for tech, hours in ((tomas, "1.25"), (hugo, "0,75")):
        code_, payload = log(tech, hours)
        check(code_ == 201, f"Imputación de {hours} h rechazada: {payload}")
    step("Tomás imputa 1,25 h y Hugo colabora con 0,75 h")

    api.expect(422, "POST", f"{path}/resolve", {"root_cause": " ", "solution": ""}, tomas)
    solution = f"Sustitución del latiguillo {code} y purga del grupo hidráulico"
    api.expect(
        200,
        "POST",
        f"{path}/resolve",
        {"root_cause": "Latiguillo de presión agrietado", "solution": solution},
        tomas,
    )
    check(api.get(f"/machines/{machine_id}")["status"] == "operativa", "La máquina sigue parada")
    step("Rechazada resolución vacía; Tomás resuelve y la máquina vuelve a «operativa»")

    closed = api.expect(200, "POST", f"{path}/close", actor=boss)
    check(closed["status"] == "cerrada", "La avería no queda cerrada")
    check(closed["closed_by"]["id"] == boss, "El validador no es el responsable")
    step("Responsable cierra y queda como validador")

    check(closed["worked_minutes"] == 120, f"El detalle suma {closed['worked_minutes']} min")
    machine_minutes = api.get(f"/machines/{machine_id}")["worked_minutes"]
    check(machine_minutes == 120, f"La máquina suma {machine_minutes} min")
    after = {tech: api.get(f"/people/{tech}")["worked_minutes"] for tech in (tomas, hugo)}
    check(after[tomas] - before[tomas] == 75, "El total de Tomás no sube 1,25 h")
    check(after[hugo] - before[hugo] == 45, "El total de Hugo no sube 0,75 h")
    check(closed["downtime_hours"] is not None and closed["downtime_hours"] >= 2, "Parada nula")
    downtime = closed["downtime_hours"]
    step(f"Totales: avería 2 h, máquina 2 h, técnicos +1,25 h y +0,75 h; parada {downtime} h")

    searches = {
        "máquina": f"machine_id={machine_id}",
        "texto de la máquina": f"q={code.lower()}",
        "síntoma": f"symptom=recorrido%20{code}",
        "causa": "root_cause=LATIGUILLO%20DE%20PRESI%C3%93N",
        "solución parcial": f"q=latiguillo%20{code}%20y%20purga",
    }
    for label, query in searches.items():
        items = api.get(f"/incidents/history?{query}")["items"]
        check(
            [item["id"] for item in items][:1] == [incident["id"]],
            f"El histórico no encuentra la avería por {label}",
        )
    detail = api.get(path)
    check(detail["solution"] == solution and detail["root_cause"], "Falta documentación")
    step("El histórico la encuentra por máquina, síntoma, causa y texto parcial de la solución")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument("--api", default="http://localhost:8000/api/v1", help="URL base de la API")
    args = parser.parse_args()
    print(f"Recorrido completo contra {args.api}")
    try:
        run(Api(args.api))
    except (StepFailed, urllib.error.URLError) as error:
        print(f"  ✗ {error}", file=sys.stderr)
        sys.exit(1)
    print("Recorrido correcto")


if __name__ == "__main__":
    main()
