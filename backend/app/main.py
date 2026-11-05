from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_error_handlers
from app.api.routers import config, health, incidents, machines, people
from app.config import get_settings

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Gestión de mantenimiento correctivo", version="0.3.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    for router in (health.router, config.router, machines.router, people.router, incidents.router):
        app.include_router(router, prefix=API_PREFIX)
    return app


app = create_app()
