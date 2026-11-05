from collections.abc import Callable

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import URL

from app.models import Base
from tests.conftest import alembic_config

TABLES = {"machines", "people", "incidents", "work_logs"}


def test_migracion_desde_base_vacia_y_vuelta_atras(make_database: Callable[[], URL]) -> None:
    url = make_database()
    config = alembic_config(url)
    engine = create_engine(url)
    try:
        command.upgrade(config, "head")
        tables = set(inspect(engine).get_table_names())
        assert tables >= TABLES
        assert "incident_number_seq" in inspect(engine).get_sequence_names()

        command.downgrade(config, "base")
        assert set(inspect(engine).get_table_names()) == {"alembic_version"}
        assert "incident_number_seq" not in inspect(engine).get_sequence_names()

        command.upgrade(config, "head")
        assert set(inspect(engine).get_table_names()) >= TABLES
    finally:
        engine.dispose()


def test_modelos_y_migracion_coinciden(migrated_url: URL) -> None:
    engine = create_engine(migrated_url)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            assert compare_metadata(context, Base.metadata) == []
    finally:
        engine.dispose()
