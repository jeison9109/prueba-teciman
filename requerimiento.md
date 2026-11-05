Contexto y objetivo
T e pedimos desarrollar una aplicación web sencilla de gestión de mantenimiento
correctivo: registrar máquinas y personas, abrir averías sobre las máquinas, resolverlas
imputando horas y dejar constancia de cómo se solucionaron.
Esta prueba es la última fase del proceso de selección de T éciman Digital. No buscamos
un producto terminado, sino ver cómo modelas un problema real, cómo organizas el
código y qué decisiones tomas cuando el enunciado no lo dice todo.
La idea de fondo es clara: cada avería resuelta debe quedarse como conocimiento
reutilizable. Si una máquina vuelve a fallar igual dentro de un año, cualquier técnico
debería poder consultar qué pasó y cómo se arregló.
Qué debe hacer la aplicación
La aplicación cubre el ciclo completo de una avería, desde que se detecta hasta que se
cierra y queda documentada.
1. Gestión de máquinas. Alta, edición, baja y listado de máquinas con filtros por estado,
ubicación o tipo. Desde la ficha de cada máquina se ve su historial de averías.
2. Gestión de personas. Alta, edición y baja de las personas que reportan averías o las
resuelven (técnicos de mantenimiento, operarios, responsables).
3. Registro de averías. Cualquier persona puede abrir una avería sobre una máquina
describiendo qué le ocurre: síntoma, prioridad, si la máquina está parada y cuándo
empezó.
4. Ciclo de vida de la avería. Cada avería pasa por estos estados:
1. Abierta: registrada, sin técnico asignado.
2. Asignada: un técnico la tiene a su cargo.
3. En curso: se está trabajando en ella.
4. Resuelta: el técnico la da por solucionada y documenta la causa y la solución.
5. Cerrada: un responsable la valida.
Prueba técnica — Aplicación de gestión de mantenimiento
Page 1 of 6
5. Imputación de horas. Uno o varios técnicos imputan horas a una avería, cada uno con su
fecha y una breve descripción del trabajo hecho. La aplicación calcula el total de horas por
avería, por máquina y por técnico.
6. Resolución y conocimiento. Para pasar a Resuelta es obligatorio rellenar la causa raíz y
la solución aplicada. Estos campos son el núcleo de la prueba.
7. Consulta del histórico. Un buscador permite encontrar averías pasadas por máquina,
síntoma, causa o texto libre de la solución, para que un técnico vea si el problema ya
ocurrió antes y cómo se arregló.
Modelo de datos orientativo
Estos son los campos mínimos que esperamos. Puedes añadir, renombrar o normalizar lo
que consideres, siempre que justifiques el cambio en el README.
Máquina
Persona
Campo Tipo Notas
Código T exto, único Identificador interno, p. ej. PRE-004
Nombre T exto Obligatorio
Tipo / familia Lista Prensa, CNC, inyectora, compresor…
Fabricante y modelo T exto
Número de serie T exto
Ubicación T exto o lista Nave, línea o zona
Fecha de puesta en marcha Fecha
Criticidad Lista Alta, media, baja
Estado Lista Operativa, en avería, fuera de servicio, de baja
Campo Tipo Notas
Nombre y apellidos T exto Obligatorio
Rol Lista T écnico de mantenimiento, operario, responsable
Prueba técnica — Aplicación de gestión de mantenimiento
Page 2 of 6
A vería (detección)
Campo Tipo Notas
Especialidad Lista Mecánica, eléctrica, electrónica, hidráulica,
neumática
Email T exto Formato validado
T eléfono T exto
Coste por hora Número (€/h) Opcional; permite calcular el coste de cada avería
Activo Sí / No Una persona de baja no se puede asignar
Campo Tipo Notas
Número Autonumérico p. ej. AV-2026-0001
Máquina Relación Obligatorio
Reportada por Relación con
Persona
Obligatorio
Fecha y hora de
detección
Fecha y hora Obligatorio
Título T exto corto Resumen del problema
Síntoma / descripción T exto largo Qué le ocurre a la máquina, en palabras de
quien la detecta
Tipo de fallo Lista Mecánico, eléctrico, electrónico, hidráulico,
neumático, software, otro
Prioridad Lista Urgente, alta, media, baja
¿Máquina parada? Sí / No Si es Sí, la máquina pasa a estado En avería
T écnico asignado Relación con
Persona
Solo personas con rol técnico
Estado Lista Abierta, asignada, en curso, resuelta,
cerrada
Prueba técnica — Aplicación de gestión de mantenimiento
Page 3 of 6
A vería (resolución y conocimiento)
Imputación de horas
Una avería puede tener varias imputaciones de varios técnicos. Una máquina puede tener
muchas averías.
Campo Tipo Notas
Diagnóstico / causa raíz T exto largo Obligatorio para resolver. Por qué ha
fallado, no solo qué ha fallado
Solución aplicada T exto largo Obligatorio para resolver. Pasos
seguidos para arreglarla
Componentes o repuestos
sustituidos
T exto o lista Referencia y cantidad
Tipo de solución Lista Reparación definitiva, provisional,
sustitución, ajuste
Recomendación preventiva T exto largo Qué hacer para que no se repita
Fecha y hora de resolución Fecha y hora Se rellena al pasar a Resuelta
Tiempo de parada Calculado (h) Desde la detección hasta la resolución,
si la máquina estaba parada
Validada por / fecha de cierre Relación y
fecha
Responsable que cierra la avería
Campo Tipo Notas
Avería Relación Obligatorio
T écnico Relación con
Persona
Obligatorio
Fecha Fecha No puede ser anterior a la detección de la
avería
Horas Decimal Mayor que 0, en tramos de 0,25 h
Descripción del
trabajo
T exto Qué se hizo en esa sesión
Prueba técnica — Aplicación de gestión de mantenimiento
Page 4 of 6
Requisitos técnicos
El backend debe desarrollarse obligatoriamente en Python, que es el lenguaje que más
usamos en T éciman Digital. El resto del stack es libre.
Backend: API REST en Python (FastAPI, Django o Flask, a tu elección).
Base de datos: relacional (PostgreSQL, MySQL o SQLite), con el esquema creado
mediante migraciones o un script SQL incluido.
Frontend: interfaz web usable para todas las operaciones. Puede ser un framework
(React, Vue…) o plantillas del propio backend.
Validaciones: campos obligatorios, coherencia de fechas, transiciones de estado
permitidas y obligatoriedad de causa y solución al resolver.
Datos de ejemplo: un script que cargue al menos 5 máquinas, 5 personas y 10 averías
en distintos estados, con horas imputadas.
Arranque sencillo: la aplicación debe poder levantarse en local siguiendo el README,
idealmente con Docker Compose.
Control de versiones: repositorio Git con commits frecuentes y mensajes
descriptivos; queremos ver cómo ha evolucionado el trabajo.