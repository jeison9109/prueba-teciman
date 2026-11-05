#!/usr/bin/env bash
# Verifica el arranque completo desde una base de datos vacía sin tocar la de desarrollo.
#
# Levanta un proyecto de Docker Compose aparte (con su propio volumen) en puertos
# distintos, comprueba que Alembic aplica la migración, que /api/v1/health responde y
# que el frontend sirve la aplicación, carga dos veces los datos demo (la segunda no debe
# crear nada), ejecuta el recorrido completo de la demo contra la API y la pantalla de
# histórico, y al terminar elimina solo ese proyecto temporal.
#
# Uso: scripts/verify-stack.sh            (usa .env si existe, si no .env.example)
#      KEEP=1 scripts/verify-stack.sh     (deja el proyecto levantado para inspeccionarlo)
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="mantenimiento_verify"
ENV_FILE=".env"
[[ -f "$ENV_FILE" ]] || ENV_FILE=".env.example"

export POSTGRES_PORT="${VERIFY_POSTGRES_PORT:-55432}"
export BACKEND_PORT="${VERIFY_BACKEND_PORT:-58000}"
export FRONTEND_PORT="${VERIFY_FRONTEND_PORT:-55173}"

compose() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" "$@"; }

cleanup() {
  if [[ "${KEEP:-0}" != "1" ]]; then
    echo "==> Eliminando el proyecto temporal $PROJECT y su volumen"
    compose down --volumes --remove-orphans >/dev/null 2>&1
  fi
}
trap cleanup EXIT

wait_for() {
  local url="$1" tries="${2:-60}"
  for ((i = 0; i < tries; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "No responde: $url" >&2
  return 1
}

echo "==> Partiendo de un volumen vacío para $PROJECT"
compose down --volumes --remove-orphans >/dev/null 2>&1 || true

echo "==> Construyendo y arrancando db, backend y frontend"
compose up -d --build --wait db backend
compose up -d frontend

echo "==> Migración aplicada por Alembic"
compose exec -T backend alembic current
compose logs backend | grep -E "Running upgrade" || true

echo "==> Salud del backend"
wait_for "http://localhost:${BACKEND_PORT}/api/v1/health"
curl -fsS "http://localhost:${BACKEND_PORT}/api/v1/health"
echo

echo "==> Frontend (Vite) y proxy /api"
wait_for "http://localhost:${FRONTEND_PORT}/"
curl -fsS "http://localhost:${FRONTEND_PORT}/" | grep -q '<div id="root">'
curl -fsS "http://localhost:${FRONTEND_PORT}/api/v1/health" | grep -q '"status":"ok"'
echo "Frontend sirve la aplicación y el proxy alcanza la API"

echo "==> Segunda ejecución de las migraciones (debe ser un no-op)"
compose exec -T backend alembic upgrade head

echo "==> Carga de datos demo (primera vez)"
compose exec -T backend python -m scripts.seed_demo

echo "==> Carga de datos demo (segunda vez: no debe crear nada)"
second=$(compose exec -T backend python -m scripts.seed_demo)
echo "$second"
if ! grep -q "máquinas: 0 nuevas.*personas: 0 nuevas.*averías: 0 nuevas.*imputaciones nuevas: 0" <<<"$second"; then
  echo "La segunda carga demo ha creado datos: no es idempotente" >&2
  exit 1
fi

echo "==> Recorrido completo de la demo contra la API"
compose exec -T backend python -m scripts.walkthrough

echo "==> Histórico a través del proxy del frontend"
curl -fsS "http://localhost:${FRONTEND_PORT}/api/v1/incidents/history?q=junta%20t%C3%B3rica" \
  | grep -q '"code":"PRE-001"'
curl -fsS "http://localhost:${FRONTEND_PORT}/historico" | grep -q '<div id="root">'
echo "El histórico encuentra la reparación demo y la ruta /historico sirve la aplicación"

echo "==> Verificación correcta"
