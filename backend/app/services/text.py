"""Utilidades de texto para consultas parametrizadas."""


def contains_pattern(value: str) -> str:
    """Patrón ILIKE de coincidencia parcial con los comodines del usuario escapados."""
    escaped = value.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
