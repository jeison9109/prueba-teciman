import pytest
from pydantic import ValidationError

from app.config import Settings


def test_lee_origenes_cors_separados_por_comas(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, http://127.0.0.1:5173")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_zona_de_operacion_por_defecto_y_validada(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPERATION_TIMEZONE", raising=False)
    assert Settings(_env_file=None).operation_timezone == "Europe/Madrid"
    monkeypatch.setenv("OPERATION_TIMEZONE", "Marte/Olympus")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
