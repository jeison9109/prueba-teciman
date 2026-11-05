# Instrucciones para agentes y colaboradores

Lee [spec.md](spec.md) antes de modificar el código. Úsalo como contrato funcional y registra en el README cualquier ajuste deliberado. Trabaja por fases y completa cada recorrido de API a UI antes de abrir el siguiente.

## Organización del repositorio

```text
frontend/src/
  app/                 # router, providers y composición global
  features/            # machines, people, incidents, history
  shared/
    api/               # cliente HTTP y errores comunes
    components/        # controles, estados de carga y componentes reutilizados
    hooks/             # comportamiento compartido entre dominios
    utils/             # funciones puras compartidas
backend/
  app/
    api/routers/       # controladores FastAPI por recurso
    schemas/           # contratos de entrada y salida
    services/          # casos de uso y transacciones
    models/            # modelos SQLAlchemy
    db/                # configuración, sesiones y consultas compartidas si surgen
  migrations/          # revisiones Alembic
  tests/
  scripts/             # carga explícita de datos demo
```

La estructura es incremental. Crea directorios cuando tengan contenido y conserva las piezas específicas dentro de su dominio.

## Frontend

- Usa React con TypeScript estricto. Separa páginas, componentes, hooks y llamadas HTTP dentro de cada feature conforme crezcan.
- Extrae componentes cuando haya una interacción reutilizable o una responsabilidad clara. Reutiliza campos, confirmaciones y estados de carga donde realmente coincidan. Mantén explícitas las diferencias entre formularios.
- Extrae hooks para comportamiento con estado, efectos o acceso a datos, como `useIncidentActions` o `useMachineList`. Coloca el formateo de horas y fechas en funciones puras. Evita wrappers que solo cambian el nombre de una función.
- Centraliza el cliente HTTP, el actor demo y la lectura de errores. Conserva filtros y paginación en la URL cuando deban sobrevivir a la navegación. Tras mutaciones, refresca el detalle y las listas o totales afectados.
- La UI guía al usuario y la API decide permisos y reglas. Usa etiquetas asociadas a campos, navegación por teclado y mensajes de error próximos al dato. Presenta horas con formato local y envía decimales en el formato acordado.

## Backend

- El router recibe y valida el contrato, delega al servicio y mapea errores de dominio a HTTP. Pydantic valida forma y tipos. Los servicios validan roles, fechas y transiciones y ejecutan casos de uso. Las restricciones SQL protegen integridad persistente.
- Mantén una transacción por caso de uso de escritura. Usa bloqueos de fila donde se comprueban invariantes que pueden cambiar concurrentemente, como rol y vigencia del técnico, estado administrativo de máquina o estado de avería. Documenta un orden de adquisición coherente entre servicios. Tras adquirir los bloqueos, vuelve a evaluar las precondiciones antes de persistir. Devuelve conflictos de forma controlada.
- Centraliza las reglas del ciclo de vida y las consultas reutilizadas. Usa SQLAlchemy directamente desde el servicio para consultas simples y extrae consultas complejas cuando tengan un motivo concreto. Calcula sumas en SQL y evita N+1. Usa operaciones parametrizadas.
- Aplica cambios de esquema mediante una revisión Alembic. Revisa el SQL generado, contempla datos existentes y verifica la migración desde una base limpia y desde la versión anterior cuando exista. Carga el seed con una orden separada y conserva su idempotencia.
- Configura por entorno la URL de base de datos, orígenes locales y zona de operación. Incluye `.env.example` sin secretos y documenta la identidad simulada para uso local.

## Flujo de trabajo y verificación

1. Identifica el criterio de aceptación que cubre el cambio y localiza el código existente antes de crear componentes, servicios o utilidades.
2. Implementa una porción pequeña y verificable. Incluye pruebas de regresión para reglas de negocio que cambien, especialmente fechas, estados, permisos, histórico y paradas simultáneas.
3. Ejecuta pytest con PostgreSQL para integración, Ruff para Python y ESLint, comprobación de tipos y build de Vite para el frontend. Documenta los comandos reales en el README cuando estén configurados. Usa PostgreSQL para probar bloqueos y migraciones.
4. Comprueba el flujo afectado desde la interfaz. Antes de entregar, valida Compose desde una base vacía, aplica migraciones, ejecuta dos veces la carga demo y recorre registro, asignación, inicio, imputación, resolución, cierre y búsqueda.
5. Agrupa cambios relacionados en commits pequeños, descriptivos y verificables. Ejemplos válidos son `feat: registrar averías con parada` y `test: cubrir cierre por responsable`. Conserva los cambios ajenos y registra las verificaciones pendientes cuando no puedas ejecutarlas.

Una fase se considera completa cuando cumple sus criterios, el contrato API coincide con la UI y cualquier instrucción nueva de arranque o migración figura en el README.
