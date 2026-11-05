from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Role, Specialty
from app.schemas.common import BlankToNone, InputModel, Trimmed, reject_null

# Mismo criterio que la restricción ck_people_email_format.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def _lower(value: str | None) -> str | None:
    return value.lower() if value is not None else None


FullName = Annotated[str, Trimmed, Field(min_length=1, max_length=160)]
Email = Annotated[
    Annotated[str, Field(max_length=254, pattern=EMAIL_PATTERN)] | None,
    BlankToNone,
    AfterValidator(_lower),
]
Phone = Annotated[Annotated[str, Field(max_length=40)] | None, BlankToNone]
HourlyCost = Annotated[
    Decimal | None,
    Field(ge=0, max_digits=10, decimal_places=2, description='EUR por hora, p. ej. "35.50"'),
]


class PersonCreate(InputModel):
    full_name: FullName
    role: Role
    specialty: Specialty | None = None
    email: Email = None
    phone: Phone = None
    hourly_cost: HourlyCost = None


class PersonUpdate(InputModel):
    """Cambio parcial. `active: true` reactiva; la baja se hace con DELETE o `active: false`."""

    full_name: FullName | None = None
    role: Role | None = None
    specialty: Specialty | None = None
    email: Email = None
    phone: Phone = None
    hourly_cost: HourlyCost = None
    active: bool | None = None

    _required = field_validator("full_name", "role", "active", mode="before")(reject_null)


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    role: Role
    specialty: Specialty | None
    email: str | None
    phone: str | None
    hourly_cost: Decimal | None
    active: bool
    created_at: datetime
    updated_at: datetime


class PersonDetail(PersonOut):
    worked_minutes: int = Field(description="Minutos imputados por la persona")
    open_assignments: int = Field(description="Averías asignadas o en curso a su nombre")
