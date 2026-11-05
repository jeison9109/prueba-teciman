from datetime import date

from sqlalchemy import CheckConstraint, Date, Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, str_enum
from app.models.enums import Criticality, MachineAdminStatus


class Machine(TimestampMixin, Base):
    __tablename__ = "machines"
    __table_args__ = (
        CheckConstraint("code <> '' AND code = upper(btrim(code))", name="code_normalized"),
        CheckConstraint("btrim(name) <> ''", name="name_not_blank"),
        CheckConstraint("btrim(type) <> ''", name="type_not_blank"),
        CheckConstraint("btrim(location) <> ''", name="location_not_blank"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(80), index=True)
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    model: Mapped[str | None] = mapped_column(String(120))
    serial_number: Mapped[str | None] = mapped_column(String(80))
    location: Mapped[str] = mapped_column(String(120), index=True)
    commissioning_date: Mapped[date | None] = mapped_column(Date)
    criticality: Mapped[Criticality] = mapped_column(str_enum(Criticality, "criticality"))
    admin_status: Mapped[MachineAdminStatus] = mapped_column(
        str_enum(MachineAdminStatus, "admin_status"),
        default=MachineAdminStatus.OPERATIVA,
        server_default=MachineAdminStatus.OPERATIVA.value,
        index=True,
    )
