from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

from app.models.enums import Criticality, MachineAdminStatus, MachineStatus
from app.schemas.common import BlankToNone, InputModel, Trimmed, reject_null


def _normalize_code(value: object) -> object:
    return value.strip().upper() if isinstance(value, str) else value


MachineCode = Annotated[
    str, BeforeValidator(_normalize_code), Field(min_length=1, max_length=40, examples=["PRE-004"])
]
Name = Annotated[str, Trimmed, Field(min_length=1, max_length=120)]
Type = Annotated[str, Trimmed, Field(min_length=1, max_length=80)]
Location = Annotated[str, Trimmed, Field(min_length=1, max_length=120)]
OptionalLong = Annotated[Annotated[str, Field(max_length=120)] | None, BlankToNone]
OptionalSerial = Annotated[Annotated[str, Field(max_length=80)] | None, BlankToNone]
# La baja no se elige en el formulario: se hace con DELETE.
EditableAdminStatus = Literal[MachineAdminStatus.OPERATIVA, MachineAdminStatus.FUERA_DE_SERVICIO]


class MachineCreate(InputModel):
    code: MachineCode
    name: Name
    type: Type
    manufacturer: OptionalLong = None
    model: OptionalLong = None
    serial_number: OptionalSerial = None
    location: Location
    commissioning_date: date | None = None
    criticality: Criticality
    admin_status: EditableAdminStatus = MachineAdminStatus.OPERATIVA


class MachineUpdate(InputModel):
    """Cambio parcial: solo se aplican los campos enviados. `null` vacía un campo opcional."""

    code: MachineCode | None = None
    name: Name | None = None
    type: Type | None = None
    manufacturer: OptionalLong = None
    model: OptionalLong = None
    serial_number: OptionalSerial = None
    location: Location | None = None
    commissioning_date: date | None = None
    criticality: Criticality | None = None
    admin_status: EditableAdminStatus | None = None

    _required = field_validator(
        "code", "name", "type", "location", "criticality", "admin_status", mode="before"
    )(reject_null)


class MachineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    type: str
    manufacturer: str | None
    model: str | None
    serial_number: str | None
    location: str
    commissioning_date: date | None
    criticality: Criticality
    admin_status: MachineAdminStatus = Field(
        description="Condición administrativa guardada: operativa, fuera_de_servicio o de_baja"
    )
    status: MachineStatus = Field(
        description="Estado efectivo: en_averia mientras una avería activa cause parada"
    )
    created_at: datetime
    updated_at: datetime


class MachineDetail(MachineOut):
    worked_minutes: int = Field(description="Minutos imputados en todas sus averías")
    open_incidents: int = Field(description="Averías que no están cerradas")
