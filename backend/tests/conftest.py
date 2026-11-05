"""Pruebas de integración contra PostgreSQL.

Cada sesión de pruebas crea una base de datos temporal con nombre único a partir de
TEST_DATABASE_URL (o DATABASE_URL) y la elimina al terminar. Nunca se toca la base
indicada en la URL: solo se usa para conectarse y crear la temporal.
"""

import os
import uuid
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, make_url, text
from sqlalchemy.engine import URL

from app.config import get_settings

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _base_url() -> URL:
    raw = os.environ.get("TEST_DATABASE_URL") or get_settings().database_url
    return make_url(raw)


def _admin_engine() -> Engine:
    return create_engine(_base_url().set(database="postgres"), isolation_level="AUTOCOMMIT")


@pytest.fixture(scope="session")
def make_database() -> Iterator[object]:
    """Fábrica de bases de datos vacías y desechables."""
    created: list[str] = []
    admin = _admin_engine()

    def factory() -> URL:
        name = f"mantenimiento_test_{uuid.uuid4().hex[:12]}"
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
        created.append(name)
        return _base_url().set(database=name)

    yield factory

    with admin.connect() as connection:
        for name in created:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    admin.dispose()


def alembic_config(url: URL) -> Config:
    config = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    config.attributes["database_url"] = url.render_as_string(hide_password=False)
    return config


@pytest.fixture(scope="session")
def migrated_url(make_database: object) -> URL:
    url: URL = make_database()  # type: ignore[operator]
    command.upgrade(alembic_config(url), "head")
    return url


@pytest.fixture
def engine(migrated_url: URL) -> Iterator[Engine]:
    engine = create_engine(migrated_url)
    yield engine
    engine.dispose()
