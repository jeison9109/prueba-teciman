# Gestión de mantenimiento correctivo

Prueba técnica de Téciman Digital. El enunciado original está en
[requerimiento.md](requerimiento.md), el contrato funcional en [spec.md](spec.md) y la guía de
arquitectura y trabajo en [AGENTS.md](AGENTS.md).

**Estado: Fase 2 (catálogos).** Además de la base ejecutable, hay API y pantallas de máquinas y
personas con filtros, fichas, edición y bajas lógicas, y un selector de persona activa que simula
la identidad. El flujo de averías, el histórico y los datos de demostración llegan en las fases 3
y 4.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8, TypeScript estricto, ESLint (typescript-eslint), Vitest |
| Backend | Python 3.12+, FastAPI, Pydantic, SQLAlchemy 2, Alembic, uv |
| Base de datos | PostgreSQL 16 |
| Entorno local | Docker Compose |

```text
backend/    API FastAPI, modelos, migraciones Alembic y pruebas (pytest)
frontend/   Aplicación React + Vite
scripts/    verify-stack.sh: verificación de arranque desde una base vacía
```

## Arranque desde cero

Requisitos: Docker con Docker Compose v2 y `make` (opcional: cada objetivo del `Makefile` es una
orden corta que se puede ejecutar a mano).

```bash
cp .env.example .env      # ajusta POSTGRES_PASSWORD y, si hace falta, los puertos
make up                   # docker compose up -d --build
```

Compose levanta tres servicios:

| Servicio | URL | Notas |
| --- | --- | --- |
| `db` | `localhost:5432` | PostgreSQL con volumen persistente `db-data` |
| `backend` | http://localhost:8000 | Aplica `alembic upgrade head` al arrancar. Documentación OpenAPI en `/docs` |
| `frontend` | http://localhost:5173 | Vite en modo desarrollo. Redirige `/api` al backend |

**Primer uso.** Con la base vacía, la aplicación pide crear el primer responsable y lo deja como
persona activa. Desde ahí se dan de alta máquinas y el resto de personas. Los datos de
demostración llegarán con un script explícito en la Fase 4.

Si ya usas alguno de esos puertos, cambia `POSTGRES_PORT`, `BACKEND_PORT` o `FRONTEND_PORT` en
`.env`.

Para parar: `make down` (conserva los datos). `docker compose down -v` borra también el volumen
de la base de datos.

## Migraciones

El backend aplica las migraciones pendientes cada vez que arranca. Para aplicarlas a mano:

```bash
make migrate                                   # docker compose exec backend alembic upgrade head
docker compose exec backend alembic current    # revisión aplicada
docker compose exec backend alembic history    # revisiones disponibles
```

Fuera de Docker (con el PostgreSQL de Compose levantado y `DATABASE_URL` en `.env` apuntando a
`localhost`):

```bash
cd backend
uv sync
uv run alembic upgrade head
```

Para crear una revisión nueva: `uv run alembic revision --autogenerate -m "descripción"`, revisar
el archivo generado en `backend/migrations/versions/` (Alembic no detecta secuencias ni algunos
CHECK) y probarla desde una base vacía.

## Verificar los servicios

```bash
curl http://localhost:8000/api/v1/health
# {"status":"ok","database":"ok","migration":"0001"}
```

`/api/v1/health` responde `200` si la base de datos acepta consultas y tiene migraciones
aplicadas, e incluye la revisión de Alembic. Responde `503` si no puede conectar o si la base aún
no está migrada. La página http://localhost:5173 muestra ese mismo estado.

Verificación completa desde una base vacía:

```bash
make verify     # scripts/verify-stack.sh
```

El script levanta un proyecto de Compose aparte (`mantenimiento_verify`) con su propio volumen y
en otros puertos (55432, 58000 y 55173). Comprueba que Alembic aplica la migración, que el
endpoint de salud y el frontend responden y que una segunda migración no hace nada. Después
elimina solo ese proyecto temporal y no toca la base de datos de desarrollo. Con `KEEP=1` lo deja
levantado para inspeccionarlo.

## Lint, tipos, pruebas y build

Instalación local de dependencias: `make install` (`uv sync` en `backend/` y `npm ci` en
`frontend/`). Requiere [uv](https://docs.astral.sh/uv/) y Node 22.12 o superior.

| Objetivo | Orden real |
| --- | --- |
| `make backend-lint` | `cd backend && uv run ruff check . && uv run ruff format --check .` |
| `make backend-typecheck` | `cd backend && uv run mypy` (modo estricto) |
| `make backend-test` | `cd backend && uv run pytest` |
| `make frontend-lint` | `cd frontend && npm run lint` (ESLint, cero avisos) |
| `make frontend-typecheck` | `cd frontend && npm run typecheck` (`tsc -b`) |
| `make frontend-test` | `cd frontend && npm test` (Vitest + Testing Library) |
| `make frontend-build` | `cd frontend && npm run build` |
| `make check` | Todo lo anterior en orden |

Las pruebas del backend son de integración contra PostgreSQL. Se conectan a `TEST_DATABASE_URL`
o, si no existe, a `DATABASE_URL`. Esa base solo se usa para conectarse: cada ejecución crea bases
temporales `mantenimiento_test_<id>`, aplica la migración en ellas y las elimina al terminar. Con
`make up` en marcha y el `.env` de ejemplo funcionan sin más configuración.

Qué cubren ahora:

- Esquema: migración desde base vacía, vuelta atrás y de nuevo arriba; modelos y migración sin
  deriva; restricciones SQL (unicidad, formatos, estados, tramos de 0,25 h y claves foráneas).
- API de máquinas: permisos por actor, normalización y unicidad del código (también en altas
  simultáneas), campos obligatorios vacíos, paginación, filtros, estado efectivo con dos paradas
  simultáneas, baja solo con averías cerradas y conservación de horas e historial.
- API de personas: alta inicial, validación de email y coste, filtros, bloqueo de baja y cambio de
  rol de un técnico con averías a su cargo, último responsable activo (también con dos bajas
  simultáneas), reactivación y conservación de relaciones.
- Frontend: alta del primer responsable, filtros leídos de la URL, acciones ocultas a quien no es
  responsable, envío de `X-Actor-Id`, errores junto a cada campo, bajas bloqueadas con su motivo,
  formato de horas y fechas, y la página de estado.

Las averías e imputaciones de estas pruebas se insertan con SQL porque su API llega en la Fase 3.

## Configuración

Todas las variables están en [.env.example](.env.example), sin secretos reales.

| Variable | Uso |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales del PostgreSQL local. Compose construye con ellas la URL del backend |
| `DATABASE_URL` | Solo para ejecutar backend, Alembic o pruebas fuera de Docker |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas |
| `OPERATION_TIMEZONE` | Zona de operación (`Europe/Madrid` por defecto) |
| `POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT` | Puertos publicados en el host |

**Identidad simulada.** El selector «Persona activa» de la cabecera lista las personas activas.
La elegida se recuerda en el navegador (`localStorage`) y el cliente HTTP la envía como
`X-Actor-Id` en cada escritura. La API carga a esa persona y valida que exista, esté activa y
tenga el rol necesario. Es una simulación local sin autenticación real. Las lecturas no necesitan
actor. Con «Solo consulta» la interfaz oculta las acciones de gestión.

## API (Fase 2)

Documentación interactiva en http://localhost:8000/docs. Prefijo `/api/v1`.

| Recurso | Endpoints | Filtros |
| --- | --- | --- |
| Máquinas | `GET/POST /machines`, `GET/PATCH/DELETE /machines/{id}` | `status` (estado efectivo), `location` y `type` (coincidencia parcial sin distinguir mayúsculas) |
| Personas | `GET/POST /people`, `GET/PATCH/DELETE /people/{id}` | `role`, `active` |

- Listados con `page` y `page_size` (25 por defecto, máximo 100) que devuelven `items`, `total`,
  `page` y `page_size`. Máquinas por código y personas por nombre, con desempate por ID. Incluyen
  los registros de baja salvo que se filtre.
- El detalle de máquina añade `worked_minutes` (horas acumuladas de todas sus averías) y
  `open_incidents`. El de persona añade `worked_minutes` y `open_assignments` (averías asignadas o
  en curso). Las sumas se calculan en SQL.
- `POST`, `PATCH` y `DELETE` exigen un responsable activo en `X-Actor-Id`. `PATCH` es parcial: solo
  cambia los campos enviados, `null` vacía un opcional y rechaza vaciar un obligatorio.
- `DELETE` es una baja lógica (`204`, idempotente): la máquina pasa a `de_baja` y la persona a
  inactiva. Se conservan todos los registros y relaciones.

**Formato de error.** Todas las respuestas de error comparten esta forma:

```json
{"code": "machine_code_taken", "message": "Ya existe una máquina con ese código",
 "fields": [{"field": "code", "message": "Ya existe una máquina con ese código"}]}
```

`code` es estable para programas, `message` está en español para la interfaz y `fields` lista los
campos afectados cuando aplica. Códigos HTTP: `403` actor ausente, inválido, inactivo o sin
permiso (`actor_required`, `actor_invalid`, `actor_not_found`, `actor_inactive`,
`actor_role_forbidden`); `404` recurso inexistente; `409` conflicto (`machine_code_taken`,
`machine_retired`, `machine_has_open_incidents`, `technician_has_open_incidents`,
`last_responsable`); `422` datos no válidos (`validation_error`).

**Concurrencia.** Cada escritura es una transacción. Las reglas que dependen de otras filas se
comprueban tras bloquear con `SELECT … FOR UPDATE/SHARE` en un orden fijo: personas (actor,
persona afectada y, si cambia rol o vigencia, todos los responsables activos) en una sola consulta
por ID ascendente, después máquinas y después averías. Tras los bloqueos se repiten las consultas
de comprobación. Ver `backend/app/services/locking.py`.

## Esquema inicial

La migración `0001` crea las tablas `machines`, `people`, `incidents` y `work_logs` y la
secuencia `incident_number_seq`. Las enumeraciones se guardan como `VARCHAR` con `CHECK`, con los
valores estables de la API (`en_curso`, `fuera_de_servicio`…). Las etiquetas en español viven en
la interfaz.

Restricciones en la base de datos:

- Claves foráneas `RESTRICT`: no se puede borrar físicamente una máquina o persona con historial.
- Código de máquina único y guardado en mayúsculas sin espacios en los extremos. Número de avería
  único con formato `AV-AAAA-NNNN` (cuatro dígitos como mínimo).
- Textos obligatorios sin cadenas vacías ni solo espacios. Email con formato básico y coste por
  hora `NUMERIC(10,2)` no negativo.
- Coherencia de estado en la avería: solo `abierta` carece de técnico asignado; `resuelta` y
  `cerrada` exigen hora de resolución, causa raíz y solución con contenido; solo `cerrada` tiene
  validador y hora de cierre; resolución posterior a la detección y cierre posterior a la
  resolución.
- Imputaciones en minutos enteros, positivos y múltiplos de 15.

Las reglas que dependen de otras filas o del momento actual se aplicarán en los servicios de las
fases 2 y 3, dentro de la transacción y con bloqueos de fila. Entre ellas: rol técnico del
asignado, persona activa, imputación no anterior al día de detección, detección no futura y
estado efectivo de la máquina.

## Decisiones respecto al enunciado

- **Estado de la máquina.** Se guarda el estado administrativo (`operativa`,
  `fuera_de_servicio`, `de_baja`). `en_averia` no se guarda: la API lo derivará de las averías
  abiertas, asignadas o en curso que causan parada, como indica la spec. Así, al resolver la
  última parada se recupera la condición previa sin tener que recordarla aparte.
- **Tipo y ubicación de máquina** son texto obligatorio y no una lista cerrada. El enunciado da
  ejemplos (prensa, CNC…), pero la spec no fija valores y los necesita para filtrar.
- **Criticidad** es obligatoria. La spec la define como lista cerrada sin valor por defecto.
- **Horas imputadas** se guardan como minutos enteros (spec). La API recibirá horas decimales en
  tramos de 0,25 h.
- **Tiempo de parada** no se guarda: se calcula en el backend a partir de detección y resolución.
- **Numeración de averías.** La secuencia existe desde la migración inicial. La composición
  `AV-<año en la zona de operación>-<n>` se hará en el servicio de alta (Fase 3).
- **Primer responsable.** La gestión de personas exige un responsable activo, así que una base
  vacía no tendría a nadie con permiso. `POST /people` admite una petición sin actor solo si la
  tabla de personas está vacía y la persona es responsable. Un bloqueo de tabla evita dos altas
  iniciales simultáneas. En cuanto existe una persona, la excepción deja de aplicarse.
- **Bajas.** `DELETE` hace la baja lógica. Una persona inactiva se puede reactivar con
  `PATCH {"active": true}`. Una máquina de baja queda solo para consulta (`409` al editarla).
  La condición administrativa se elige entre operativa y fuera de servicio; la baja solo por
  `DELETE`.
- **Nombre y apellidos** se guardan en un único campo `full_name`, como en el esquema inicial.
- **Email** se guarda en minúsculas. El coste por hora viaja como decimal en texto (`"35.50"`) y la
  interfaz admite coma decimal.
- **Historial de averías en la ficha de máquina.** La spec lo obtiene de `GET /incidents`, que se
  implementa en la Fase 3. En la Fase 2 la ficha muestra horas acumuladas y averías sin cerrar.

## Fases

1. **Base ejecutable** (hecha): monorepo, Compose, configuración, migración inicial y verificación.
2. **Catálogos** (hecha): API y pantallas de máquinas y personas, filtros y bajas.
3. **Flujo de averías**: registrar, asignar, iniciar, imputar, resolver y cerrar.
4. **Consulta y entrega**: histórico, totales, datos de demostración y recorrido completo.
