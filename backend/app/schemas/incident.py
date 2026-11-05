from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

from app.models.enums import FailureType, IncidentStatus, MachineStatus, Priority, SolutionType
from app.schemas.common import BlankToNone, InputModel, Trimmed

TITLE_MAX = 160
TEXT_MAX = 4000
# Una imputación no puede superar una jornada completa.
MAX_HOURS_PER_LOG = Decimal(24)

Title = Annotated[str, Trimmed, Field(min_length=1, max_length=TITLE_MAX)]
LongText = Annotated[str, Trimmed, Field(min_length=1, max_length=TEXT_MAX)]
OptionalText = Annotated[Annotated[str, Field(max_length=TEXT_MAX)] | None, BlankToNone]
Id = Annotated[int, Field(ge=1)]


def hours_to_minutes(value: str) -> int:
    """Horas decimales en texto ("1.25" o "1,25") a minutos enteros, en tramos de 0,25 h."""
    try:
        hours = Decimal(value.strip().replace(",", "."))
    except InvalidOperation as error:
        raise ValueError('Indica las horas como número decimal, p. ej. "1.25"') from error
    if not hours.is_finite():
        raise ValueError('Indica las horas como número decimal, p. ej. "1.25"')
    if hours <= 0:
        raise ValueError("Las horas deben ser mayores que cero")
    if (hours * 4) % 1 != 0:
        raise ValueError("Las horas van en tramos de 0,25 h")
    if hours > MAX_HOURS_PER_LOG:
        raise ValueError(f"Máximo {MAX_HOURS_PER_LOG} h por imputación")
    return int(hours * 60)


def _check_hours(value: str) -> str:
    hours_to_minutes(value)
    return value


Hours = Annotated[
    str,
    Field(
        max_length=10,
        description='Horas decimales como texto en tramos de 0,25 h, p. ej. "1.25"',
        examples=["1.25"],
    ),
    AfterValidator(_check_hours),
]


class IncidentCreate(InputModel):
    machine_id: Id
    detected_at: datetime = Field(
        description="Instante de detección. Sin zona se interpreta en la zona de operación",
        examples=["2026-11-05T09:30:00+01:00"],
    )
    title: Title
    symptom: LongText
    failure_type: FailureType
    priority: Priority
    machine_stopped: bool = Field(description="Si la avería ha parado la máquina")


class AssignInput(InputModel):
    technician_id: Id


class ResolveInput(InputModel):
    root_cause: LongText
    solution: LongText
    replaced_parts: OptionalText = Field(None, description="Repuestos con referencia y cantidad")
    solution_type: SolutionType | None = None
    preventive_recommendation: OptionalText = None


class WorkLogCreate(InputModel):
    work_date: date = Field(description="Día de trabajo en la zona de operación")
    hours: Hours
    description: LongText

    @property
    def minutes(self) -> int:
        return hours_to_minutes(self.hours)


class PersonRef(BaseModel):
    id: int
    full_name: str


class MachineRef(BaseModel):
    id: int
    code: str
    name: str
    status: MachineStatus = Field(description="Estado efectivo actual de la máquina")


class IncidentOut(BaseModel):
    id: int
    number: str
    status: IncidentStatus
    title: str
    failure_type: FailureType
    priority: Priority
    machine_stopped: bool
    detected_at: datetime
    machine: MachineRef
    reported_by: PersonRef
    assigned_technician: PersonRef | None
    resolved_at: datetime | None
    closed_at: datetime | None
    worked_minutes: int = Field(description="Minutos imputados por todos los técnicos")
    downtime_hours: float | None = Field(
        description="Horas entre detección y resolución si hubo parada; 0 sin parada; "
        "nulo mientras la parada siga abierta"
    )


class IncidentDetail(IncidentOut):
    symptom: str
    root_cause: str | None
    solution: str | None
    replaced_parts: str | None
    solution_type: SolutionType | None
    preventive_recommendation: str | None
    closed_by: PersonRef | None
    created_at: datetime
    updated_at: datetime


SearchText = Annotated[Annotated[str, Field(max_length=200)] | None, BlankToNone]


class HistoryParams(BaseModel):
    """Filtros del histórico de conocimiento. Se combinan con AND; los vacíos se ignoran."""

    machine_id: Id | None = None
    symptom: SearchText = Field(None, description="Coincidencia parcial en el síntoma")
    root_cause: SearchText = Field(None, description="Coincidencia parcial en la causa raíz")
    q: SearchText = Field(
        None,
        description="Coincidencia parcial en código o nombre de máquina, título, síntoma, "
        "causa o solución",
    )


class HistoryItem(BaseModel):
    """Avería resuelta o cerrada con la documentación útil para reparaciones futuras."""

    id: int
    number: str
    status: IncidentStatus
    title: str
    failure_type: FailureType
    machine: MachineRef
    detected_at: datetime
    resolved_at: datetime
    closed_at: datetime | None
    assigned_technician: PersonRef | None
    symptom: str
    root_cause: str
    solution: str
    solution_type: SolutionType | None
    replaced_parts: str | None
    worked_minutes: int
    downtime_hours: float | None


class WorkLogOut(BaseModel):
    id: int
    incident_id: int
    technician: PersonRef
    work_date: date
    minutes: int
    description: str
    created_at: datetime
