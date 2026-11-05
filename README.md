# Gestión de mantenimiento correctivo

Prueba técnica de Téciman Digital. El enunciado original está en
[requerimiento.md](requerimiento.md), el contrato funcional en [spec.md](spec.md) y la guía de
arquitectura y trabajo en [AGENTS.md](AGENTS.md).

**Estado: Fase 3 (flujo de averías).** Sobre la base ejecutable y los catálogos de máquinas y
personas, se registran averías y se llevan de abiertas a cerradas (asignar, reasignar, iniciar,
imputar, resolver y cerrar) desde la API y la interfaz, con el historial de averías en la ficha de
cada máquina. El histórico de conocimiento (`/incidents/history`), los datos de demostración y el
recorrido completo desde un arranque limpio llegan en la Fase 4.

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

**Recorrido de una avería.** Con un responsable, un operario, dos técnicos y una máquina dados de
alta, cambia la «Persona activa» de la cabecera para actuar como cada uno: el operario registra la
avería en *Averías → Registrar avería*, el responsable la asigna desde el detalle, el técnico
asignado la inicia, cualquier técnico imputa horas, el asignado la resuelve y un responsable la
cierra. El detalle solo muestra las acciones que la persona activa puede hacer en ese estado.

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
- API de averías (`tests/test_incidents_api.py`): recorrido completo de la spec (un operario
  reporta una parada, un responsable asigna, el técnico inicia, dos técnicos imputan 1,25 h y
  0,75 h, el asignado resuelve y un responsable cierra; el detalle suma 2 h y los totales de
  máquina y técnico cuadran), numeración, detección futura o sin zona, máquina de baja, saltos de
  estado, permisos por rol y por técnico asignado, asignación a inactivos o no técnicos,
  resolución sin causa o solución, imputaciones negativas, cero, de 0,10 h, numéricas en vez de
  texto, anteriores a la detección, futuras o fuera de «en curso», reasignación con imputaciones
  conservadas, dos paradas simultáneas con cambio de condición administrativa durante la parada,
  filtros, orden y paginación de la bandeja e historial tras la baja de la máquina.
- Concurrencia (`tests/test_concurrency.py`, hilos con sesiones propias contra PostgreSQL): dos
  asignaciones de la misma avería, asignación frente a baja del técnico, registro frente a baja
  de la máquina y dos resoluciones frente a una imputación. Se comprobó que quitar los bloqueos
  hace fallar estas pruebas.
- Frontend: alta del primer responsable, filtros leídos de la URL, acciones ocultas a quien no es
  responsable, envío de `X-Actor-Id`, errores junto a cada campo, bajas bloqueadas con su motivo,
  formato de horas y fechas y la página de estado. En averías: acciones ofrecidas por actor y
  estado, bandeja con filtros en la URL, alta con errores de la API por campo, asignación,
  imputación con coma decimal y validación previa de tramos, resolución, cierre, horas en la zona
  de operación y el historial en la ficha de máquina.

Algunas pruebas de máquinas y personas siguen insertando averías con SQL para preparar estados
concretos (`tests/factories.py`).

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

## API

Documentación interactiva en http://localhost:8000/docs. Prefijo `/api/v1`.

| Recurso | Endpoints | Filtros |
| --- | --- | --- |
| Máquinas | `GET/POST /machines`, `GET/PATCH/DELETE /machines/{id}` | `status` (estado efectivo), `location` y `type` (coincidencia parcial sin distinguir mayúsculas) |
| Personas | `GET/POST /people`, `GET/PATCH/DELETE /people/{id}` | `role`, `active` |
| Averías | `GET/POST /incidents`, `GET /incidents/{id}` | `machine_id`, `status`, `priority` (se combinan) |
| Acciones | `POST /incidents/{id}/assign`, `/reassign`, `/start`, `/resolve`, `/close` | |
| Imputaciones | `GET/POST /incidents/{id}/work-logs` | |
| Configuración | `GET /config` (zona de operación para la interfaz) | |

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

**Averías.** Ciclo de vida de la spec, solo mediante acciones explícitas:

| Acción | De → a | Quién (`X-Actor-Id`) | Cuerpo |
| --- | --- | --- | --- |
| `POST /incidents` | — → abierta | Cualquier persona activa; queda como reportante | `machine_id`, `detected_at`, `title`, `symptom`, `failure_type`, `priority`, `machine_stopped` |
| `assign` | abierta → asignada | Responsable activo | `technician_id` (técnico activo) |
| `reassign` | asignada o en curso, sin cambiar | Responsable activo | `technician_id` (otro técnico activo) |
| `start` | asignada → en curso | El técnico asignado | — |
| `resolve` | en curso → resuelta | El técnico asignado | `root_cause`, `solution` y opcionales `replaced_parts`, `solution_type`, `preventive_recommendation` |
| `close` | resuelta → cerrada | Responsable activo; queda como validador | — |
| `POST …/work-logs` | solo en curso | Cualquier técnico activo, a su nombre | `work_date`, `hours` (texto, p. ej. `"1.25"`), `description` |

- El número `AV-<año>-<n>` lo genera el servidor con la secuencia global y el año de la zona de
  operación. Las horas de resolución y cierre son las del servidor.
- La bandeja ordena por detección descendente con desempate por ID. Cada avería incluye máquina
  (con su estado efectivo), reportante, técnico, `worked_minutes` y `downtime_hours`. El detalle
  añade síntoma, documentación de la resolución, validador y fechas.
- `downtime_hours` se calcula en SQL: horas entre detección y resolución con dos decimales, `0`
  si no hubo parada y `null` mientras la parada siga abierta.
- Las imputaciones admiten horas positivas en tramos de 0,25 h (máximo 24 por registro) y se
  guardan en minutos. La fecha de trabajo va del día local de la detección al día local actual.
- Códigos propios: `incident_invalid_transition` (409, salto de estado), `actor_not_assigned`
  (403, no es el técnico asignado), `technician_inactive` (409), `not_a_technician`,
  `technician_not_found` y `same_technician` (422), `machine_retired` (409, máquina de baja),
  `machine_not_found` (422), `detected_in_future`, `work_date_before_detection` y
  `work_date_in_future` (422), `incident_not_in_progress` (409) e `incident_not_found` (404).

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

En averías: actor y técnico implicado se bloquean con `FOR SHARE` (una baja o cambio de rol
concurrente espera y después ve la asignación), la máquina con `FOR SHARE` al registrar (no se
puede dar de baja a la vez) y la avería con `FOR UPDATE`, que serializa todas las escrituras sobre
ella. Estado, actor y técnico asignado se comprueban con los bloqueos ya tomados.

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

Las reglas que dependen de otras filas o del momento actual se aplican en los servicios, dentro
de la transacción y con bloqueos de fila: rol técnico del asignado, persona activa, imputación no
anterior al día de detección, detección no futura y estado efectivo de la máquina. La Fase 3 no
necesita cambios de esquema, así que no hay migración nueva.

## Decisiones respecto al enunciado

- **Estado de la máquina.** Se guarda el estado administrativo (`operativa`,
  `fuera_de_servicio`, `de_baja`). `en_averia` no se guarda: la API lo deriva de las averías
  abiertas, asignadas o en curso que causan parada, como indica la spec. Así, al resolver la
  última parada se recupera la condición previa sin tener que recordarla aparte.
- **Tipo y ubicación de máquina** son texto obligatorio y no una lista cerrada. El enunciado da
  ejemplos (prensa, CNC…), pero la spec no fija valores y los necesita para filtrar.
- **Criticidad** es obligatoria. La spec la define como lista cerrada sin valor por defecto.
- **Horas imputadas** se guardan como minutos enteros (spec). La API recibe horas decimales como
  texto en tramos de 0,25 h. Admite punto o coma decimal y rechaza números JSON. Se fija un máximo
  de 24 h por imputación como límite coherente, que la spec no concreta.
- **Tiempo de parada** no se guarda: se calcula en el backend a partir de detección y resolución.
- **Numeración de averías.** `AV-<año en la zona de operación>-<n>` con la secuencia global de la
  migración inicial. El sufijo no se reinicia al cambiar de año y admite huecos.
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
- **Historial de averías en la ficha de máquina.** Se obtiene de `GET /incidents?machine_id=…`,
  con averías de todos los estados, también en máquinas de baja.
- **Zona de operación en la interfaz.** La spec pide mostrar horas en la zona configurable, que
  vive en el backend. Se añade `GET /config`, que la devuelve, y la interfaz formatea con ella
  (con `Europe/Madrid` mientras carga o si falla).
- **Detección sin zona.** `detected_at` admite un instante con zona o una hora local sin zona,
  que se interpreta en la zona de operación. La interfaz envía la hora local del formulario.
- **Detección futura.** Se rechaza, con 2 minutos de margen por desfases entre el reloj del
  navegador y el del servidor. Dentro de ese margen se guarda la hora del servidor, para que la
  resolución nunca quede antes que la detección.
- **Códigos de error de la asignación.** Un técnico que no existe o no es técnico es un dato no
  válido (`422`, el `404` queda para recursos de la ruta). Uno inactivo es un conflicto de estado
  (`409`). Reasignar al mismo técnico da `422`.
- **Quién imputa.** Solo técnicos activos, siempre a su nombre ("cada técnico registra sus propias
  imputaciones"). Un responsable no imputa.
- **Orden de comprobación en las acciones.** Primero el actor y su rol (`403`), después que la
  avería exista (`404`), después el estado (`409`) y por último que el actor sea el técnico
  asignado (`403`). Así, intentar resolver una avería sin iniciar devuelve el salto de estado.
- **Página de inicio.** La bandeja de averías pasa a ser la página de inicio, por ser el trabajo
  diario. Los desplegables de máquinas y técnicos cargan hasta 100 registros (máximo de página),
  suficiente para la demo.

## Fases

1. **Base ejecutable** (hecha): monorepo, Compose, configuración, migración inicial y verificación.
2. **Catálogos** (hecha): API y pantallas de máquinas y personas, filtros y bajas.
3. **Flujo de averías** (hecha): registrar, asignar, iniciar, imputar, resolver y cerrar.
4. **Consulta y entrega**: histórico, totales, datos de demostración y recorrido completo.
