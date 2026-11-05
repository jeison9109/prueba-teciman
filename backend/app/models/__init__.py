"""Modelos SQLAlchemy. Importar este paquete registra todas las tablas en `Base.metadata`."""

from app.models.base import Base
from app.models.incident import Incident, incident_number_seq
from app.models.machine import Machine
from app.models.person import Person
from app.models.work_log import WorkLog

__all__ = ["Base", "Incident", "Machine", "Person", "WorkLog", "incident_number_seq"]
