from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Identity, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WorkLog(Base):
    __tablename__ = "work_logs"
    __table_args__ = (
        # Horas positivas en tramos de 0,25 h, guardadas como minutos enteros.
        CheckConstraint("minutes > 0 AND mod(minutes, 15) = 0", name="minutes_quarter_hours"),
        CheckConstraint("btrim(description) <> ''", name="description_not_blank"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    incident_id: Mapped[int] = mapped_column(
        ForeignKey("incidents.id", ondelete="RESTRICT"), index=True
    )
    technician_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="RESTRICT"), index=True
    )
    work_date: Mapped[date] = mapped_column(Date)
    minutes: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
