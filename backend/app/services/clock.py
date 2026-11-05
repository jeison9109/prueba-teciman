"""Hora del servidor y conversiones a la zona de operación.

Los instantes se guardan en UTC. Las fechas de trabajo, el año del número de avería y las
detecciones sin zona se interpretan en la zona de operación configurada.
"""

from datetime import UTC, date, datetime

from app.config import get_settings


def now() -> datetime:
    """Instante actual del servidor, con zona UTC."""
    return datetime.now(UTC)


def local_date(instant: datetime) -> date:
    """Día local, en la zona de operación, de un instante con zona."""
    return instant.astimezone(get_settings().operation_zone).date()


def as_aware(value: datetime) -> datetime:
    """Un instante sin zona se interpreta como hora local de operación."""
    if value.tzinfo is None:
        return value.replace(tzinfo=get_settings().operation_zone)
    return value
