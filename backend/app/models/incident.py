from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Sequence,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, str_enum
from app.models.enums import FailureType, IncidentStatus, Priority, SolutionType

# Secuencia global para el sufijo de AV-<año>-<n>. No se reinicia al cambiar de año
# y admite huecos (spec.md, «Modelo y validaciones»).
incident_number_seq = Sequence("incident_number_seq", metadata=Base.metadata)

RESOLVED_STATES = "('resuelta', 'cerrada')"


class Incident(TimestampMixin, Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint(r"number ~ '^AV-[0-9]{4}-[0-9]{4,}$'", name="number_format"),
        CheckConstraint("btrim(title) <> ''", name="title_not_blank"),
        CheckConstraint("btrim(symptom) <> ''", name="symptom_not_blank"),
        # Abierta es el único estado sin técnico asignado.
        CheckConstraint(
            "(status = 'abierta') = (assigned_technician_id IS NULL)",
            name="assignment_matches_status",
        ),
        # Resuelta y cerrada exigen hora de resolución, causa raíz y solución con contenido.
        CheckConstraint(
            f"(status IN {RESOLVED_STATES}) = (resolved_at IS NOT NULL)",
            name="resolved_at_matches_status",
        ),
        CheckConstraint(
            f"status NOT IN {RESOLVED_STATES} OR "
            "(btrim(coalesce(root_cause, '')) <> '' AND btrim(coalesce(solution, '')) <> '')",
            name="resolution_documented",
        ),
        # Cerrada exige validador y hora de cierre, y solo cerrada los tiene.
        CheckConstraint(
            "(status = 'cerrada') = (closed_at IS NOT NULL)", name="closed_at_matches_status"
        ),
        CheckConstraint(
            "(closed_at IS NULL) = (closed_by_id IS NULL)", name="closure_has_validator"
        ),
        CheckConstraint(
            "resolved_at IS NULL OR resolved_at >= detected_at", name="resolved_after_detection"
        ),
        CheckConstraint(
            "closed_at IS NULL OR closed_at >= resolved_at", name="closed_after_resolution"
        ),
        Index("ix_incidents_machine_id_status", "machine_id", "status"),
        Index("ix_incidents_resolved_at", "resolved_at"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)

    # Detección
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id", ondelete="RESTRICT"))
    reported_by_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="RESTRICT"), index=True
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    title: Mapped[str] = mapped_column(String(160))
    symptom: Mapped[str] = mapped_column(Text)
    failure_type: Mapped[FailureType] = mapped_column(str_enum(FailureType, "failure_type"))
    priority: Mapped[Priority] = mapped_column(str_enum(Priority, "priority"), index=True)
    machine_stopped: Mapped[bool] = mapped_column(Boolean)
    assigned_technician_id: Mapped[int | None] = mapped_column(
        ForeignKey("people.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[IncidentStatus] = mapped_column(
        str_enum(IncidentStatus, "status"),
        default=IncidentStatus.ABIERTA,
        server_default=IncidentStatus.ABIERTA.value,
        index=True,
    )

    # Resolución y conocimiento
    root_cause: Mapped[str | None] = mapped_column(Text)
    solution: Mapped[str | None] = mapped_column(Text)
    replaced_parts: Mapped[str | None] = mapped_column(Text)
    solution_type: Mapped[SolutionType | None] = mapped_column(
        str_enum(SolutionType, "solution_type")
    )
    preventive_recommendation: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Validación
    closed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("people.id", ondelete="RESTRICT"), index=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
