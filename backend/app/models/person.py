from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Identity, Numeric, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, str_enum
from app.models.enums import Role, Specialty


class Person(TimestampMixin, Base):
    __tablename__ = "people"
    __table_args__ = (
        CheckConstraint("btrim(full_name) <> ''", name="full_name_not_blank"),
        CheckConstraint(
            r"email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'", name="email_format"
        ),
        CheckConstraint("hourly_cost IS NULL OR hourly_cost >= 0", name="hourly_cost_non_negative"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[Role] = mapped_column(str_enum(Role, "role"), index=True)
    specialty: Mapped[Specialty | None] = mapped_column(str_enum(Specialty, "specialty"))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(40))
    hourly_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true(), index=True)
