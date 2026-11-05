from collections.abc import Callable, Iterator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.main import app


def _client_for(url: URL) -> Iterator[TestClient]:
    engine = create_engine(url)

    def override() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_health_ok_con_migracion_aplicada(migrated_url: URL) -> None:
    for client in _client_for(migrated_url):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "database": "ok", "migration": "0001"}


def test_health_503_si_la_base_no_tiene_migraciones(make_database: Callable[[], URL]) -> None:
    for client in _client_for(make_database()):
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        assert response.json() == {"status": "error", "database": "ok", "migration": None}
