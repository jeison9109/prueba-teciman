from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(tags=["configuración"])


class PublicConfig(BaseModel):
    operation_timezone: str


@router.get("/config", response_model=PublicConfig)
def public_config() -> PublicConfig:
    """Configuración que necesita la interfaz: zona de operación para mostrar horas y fechas."""
    return PublicConfig(operation_timezone=get_settings().operation_timezone)
