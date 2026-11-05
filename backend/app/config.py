"""Configuración de la aplicación leída del entorno."""

from functools import lru_cache
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = (
        "postgresql+psycopg://mantenimiento:mantenimiento@localhost:5432/mantenimiento"
    )
    # Lista separada por comas en el entorno, p. ej. "http://localhost:5173,http://127.0.0.1:5173".
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    operation_timezone: str = "Europe/Madrid"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("operation_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError(f"Zona horaria desconocida: {value}") from error
        return value

    @property
    def operation_zone(self) -> ZoneInfo:
        return ZoneInfo(self.operation_timezone)


@lru_cache
def get_settings() -> Settings:
    return Settings()
