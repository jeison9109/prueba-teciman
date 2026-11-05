# Especificación | Gestión de mantenimiento correctivo

## Objetivo y alcance

Prueba técnica de Téciman Digital. Permitir registrar máquinas y personas, gestionar una avería desde su detección hasta su validación, imputar trabajo y recuperar el conocimiento de reparaciones anteriores. La interfaz estará en español.

**Stack propuesto.** React con Vite y TypeScript, API REST con FastAPI y Pydantic, PostgreSQL con SQLAlchemy y Alembic, y Docker Compose para el entorno local. PostgreSQL permite probar la integridad y la concurrencia con el mismo motor que usa la aplicación.

**Identidad en la demo.** Un selector visible de persona activa simula al actor. La UI envía `X-Actor-Id` en cada escritura y la API carga a la persona y valida su rol. Es una simulación local sin autenticación real. La gestión de máquinas y personas se reserva al responsable en este MVP. La lectura está disponible para el evaluador. Quedan fuera del alcance el despliegue público, las notificaciones, los adjuntos y el mantenimiento preventivo programado. El cálculo monetario es opcional.

## Modelo y validaciones

| Entidad | Datos y reglas |
| --- | --- |
| Máquina | ID interno, código obligatorio y único, nombre obligatorio, tipo/familia, fabricante, modelo, número de serie, ubicación, fecha de puesta en marcha, criticidad (alta, media, baja) y estado (operativa, en avería, fuera de servicio, de baja). Tipo y ubicación se requieren para los filtros. El código se guarda sin espacios en los extremos y en mayúsculas. |
| Persona | ID, nombre y apellidos obligatorios, rol (técnico, operario, responsable), especialidad opcional (mecánica, eléctrica, electrónica, hidráulica, neumática), email opcional con formato validado, teléfono como texto, coste por hora opcional en EUR con decimal exacto no negativo y marca de activo. |
| Avería | ID, número único generado por el servidor, máquina, reportante, detección con fecha y hora, título, síntoma, tipo de fallo (mecánico, eléctrico, electrónico, hidráulico, neumático, software, otro), prioridad (urgente, alta, media, baja), indicador de parada, técnico asignado inicialmente nulo y estado. Los datos de detección son obligatorios, incluido el indicador de parada. |
| Resolución y cierre | La avería conserva causa raíz, solución, repuestos (texto con referencia y cantidad), tipo de solución (definitiva, provisional, sustitución, ajuste), recomendación preventiva, hora de resolución, responsable validador y hora de cierre. Causa y solución se exigen al resolver. Los repuestos, el tipo de solución y la recomendación son opcionales. |
| Imputación | ID, avería, técnico, fecha de trabajo, minutos y descripción obligatoria. La API recibe horas decimales como texto, admite múltiplos positivos de 0,25 y convierte a minutos enteros. Cada técnico registra sus propias imputaciones. |

Aplicar claves foráneas, unicidad, nulabilidad y restricciones locales en la base de datos. La API recorta textos y rechaza valores obligatorios vacíos o compuestos de espacios. Definir límites coherentes en esquemas y UI (por ejemplo, título de 160 caracteres). Mantener enumeraciones estables en la API y etiquetas en español en la interfaz.

Numerar con una secuencia global de PostgreSQL y el año de creación en la zona configurada, por ejemplo `AV-2026-0001`. El sufijo tiene al menos cuatro dígitos. Se permiten huecos y la secuencia continúa al cambiar de año.

## Ciclo de vida

| Estado inicial | Acción | Estado final | Actor y condiciones |
| --- | --- | --- | --- |
| — | Registrar | Abierta | Cualquier persona activa. El actor queda como reportante. La máquina puede estar operativa, en avería o fuera de servicio. |
| Abierta | Asignar | Asignada | Responsable activo selecciona un técnico activo. |
| Asignada o en curso | Reasignar | Mismo estado | Responsable activo selecciona otro técnico activo. Las imputaciones anteriores conservan a su autor. |
| Asignada | Iniciar | En curso | Técnico activo asignado. |
| En curso | Resolver | Resuelta | Técnico activo asignado. Causa raíz y solución con contenido obligatorio. Se registra la hora en el servidor. |
| Resuelta | Cerrar | Cerrada | Responsable activo. Se guardan su ID y la hora del servidor. |

Los cambios de estado se ejecutan mediante acciones explícitas. La avería cerrada queda disponible para consulta. La demo excluye reapertura y borrado de averías. El MVP registra los datos de detección al crear y la documentación al resolver.

**Bajas.** Conservar registros y relaciones históricas. Una máquina se da de baja solo si todas sus averías están cerradas. Una persona inactiva queda fuera de nuevas escrituras y asignaciones. Bloquear la baja o el cambio de rol de un técnico con averías asignadas o en curso hasta reasignarlas. En la demo, impedir que se desactive o cambie de rol el último responsable activo. Permitir consultar los registros de baja desde sus listados y desde el histórico.

**Estado de la máquina.** Una avería marcada como parada fuerza `en_averia` mientras esté abierta, asignada o en curso. Si existen varias, resolver una mantiene la máquina en avería mientras otra siga provocando parada. Tras resolver la última se recupera la condición operativa previa, que se conserva como estado administrativo (`operativa` o `fuera_de_servicio`). Durante la parada el responsable puede actualizar esa condición y el estado visible sigue siendo `en_averia`. La baja es administrativa. El estado efectivo se deriva en el backend y se usa también al filtrar máquinas.

**Fechas y horas.** Guardar instantes con zona en UTC. Interpretar fechas de trabajo y mostrar horas en la zona de operación configurable, con `Europe/Madrid` como valor inicial de la demo. Rechazar detecciones futuras e imputaciones anteriores al día local de detección o posteriores al día local actual. Aceptar imputaciones únicamente en curso. Cualquier técnico activo puede colaborar aunque no sea el asignado. El tiempo de parada es la diferencia entre detección y resolución en horas, calculada en el backend. Es nulo mientras la parada siga abierta y vale cero si la avería no causó parada. Las horas de trabajo se suman a partir de los minutos registrados por avería, máquina o técnico. Dos técnicos trabajando dos horas representan cuatro horas de trabajo y un tiempo de parada independiente.

## Interfaz y API

Prefijo `/api/v1`. Los listados paginados devuelven `items`, `total`, `page` y `page_size` (25 por defecto, máximo 100). Usar orden estable con desempate por ID.

| Vista | Contrato principal |
| --- | --- |
| Máquinas, ficha e historial | `GET/POST /machines`, `GET/PATCH/DELETE /machines/{id}`. Filtros `status`, `location` y `type`. El detalle muestra horas acumuladas y lista de averías de todos los estados consultando `GET /incidents?machine_id=…`. |
| Personas | `GET/POST /people`, `GET/PATCH/DELETE /people/{id}`. Filtros `role` e `active`. El detalle del técnico incluye sus horas acumuladas. |
| Bandeja y detalle de averías | `GET/POST /incidents`, `GET /incidents/{id}`. Filtros por máquina, estado y prioridad. El detalle muestra detección, asignación, resolución, validación, horas y parada. |
| Acciones de avería | `POST /incidents/{id}/assign`, `/reassign`, `/start`, `/resolve` y `/close` bajo el mismo prefijo de avería. |
| Imputaciones | `GET/POST /incidents/{id}/work-logs`. Mostrar fecha, técnico, horas y trabajo realizado. |
| Histórico de conocimiento | `GET /incidents/history` restringido a resueltas y cerradas. Admite `machine_id`, `symptom`, `root_cause` y `q`. Los filtros se combinan con AND. `q` busca coincidencia parcial en código/nombre de máquina, título, síntoma, causa o solución. Comparar sin distinguir mayúsculas, usando parámetros SQL. Mostrar máquina, síntoma, causa, solución y enlace al detalle. Ordenar por resolución descendente. |

Responder `201` al crear, `204` para las bajas lógicas y `200` para lecturas, cambios y acciones con detalle. Usar `403` para actor ausente, inactivo o sin permiso, `404` para recurso de ruta inexistente, `409` para conflicto de estado o duplicado y `422` para datos inválidos. Documentar un formato común con código de error, mensaje y campos cuando aplique. La UI presenta carga, vacío, error y éxito, deshabilita envíos pendientes y ofrece solo acciones válidas para el actor y el estado.

## Entrega por fases

1. **Base ejecutable.** Monorepo, Compose, configuración, migraciones iniciales y scripts de verificación. Arranca desde una base vacía siguiendo el README.
2. **Catálogos.** API y pantallas de máquinas y personas, filtros y bajas. Verificar unicidad y preservación de relaciones.
3. **Flujo de averías.** Registrar, asignar, iniciar, imputar, resolver y cerrar con interfaz. Probar acciones prohibidas y dos paradas simultáneas. Serializar las escrituras concurrentes que afectan a la misma avería y comprobar estado y actor dentro de la transacción.
4. **Consulta y entrega.** Histórico, totales, datos de demostración y prueba de recorrido completo desde un arranque limpio.

## Criterios de aceptación

- Una instalación limpia aplica Alembic y carga con un script explícito e idempotente al menos cinco máquinas, cinco personas y diez averías repartidas por los cinco estados. Incluir una avería con imputaciones de dos técnicos y una solución que se pueda encontrar por texto.
- Un operario reporta una parada, un responsable asigna, el técnico inicia, dos técnicos imputan 1,25 h y 0,75 h, el asignado resuelve y un responsable cierra. El detalle muestra 2 h y los subtotales de máquina y técnico cuadran con las imputaciones.
- Se rechazan un salto de estado, un cierre por operario, la asignación a una persona inactiva, una resolución con causa o solución vacías, y una imputación anterior a la detección, negativa, cero o de 0,10 h.
- Con dos averías que causan parada, la máquina sigue en avería al resolver solo una y recupera su condición administrativa al resolver la segunda. Una baja conserva el acceso a su historial.
- El buscador recupera una avería resuelta o cerrada por máquina, síntoma, causa y texto parcial de solución. El detalle muestra la documentación completa.
- El README explica arranque, migraciones, carga de datos, pruebas, identidad simulada y decisiones respecto al enunciado. El repositorio contiene commits frecuentes y descriptivos.
