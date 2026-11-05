"""Reglas del ciclo de vida de averías compartidas por los servicios."""

from app.models.enums import IncidentStatus

# Estados en los que una avería con parada mantiene la máquina en avería.
STOPPING_STATES = (IncidentStatus.ABIERTA, IncidentStatus.ASIGNADA, IncidentStatus.EN_CURSO)

# Estados en los que el técnico tiene la avería a su cargo. Bloquean su baja o cambio de rol.
ASSIGNED_STATES = (IncidentStatus.ASIGNADA, IncidentStatus.EN_CURSO)
