# Plan de pruebas manuales

Plan para recorrer la aplicación desde la interfaz y comprobar que cumple
[requerimiento.md](../requerimiento.md) y [spec.md](../spec.md). Cada caso indica precondiciones,
pasos y resultado esperado. Marca cada casilla al ejecutarlo y anota en *Observaciones* lo que no
coincida.

## 1. Cobertura del requerimiento

| # | Requisito del enunciado | Estado | Dónde se ve |
| --- | --- | --- | --- |
| 1 | Máquinas: alta, edición, baja, listado con filtros por estado, ubicación y tipo; historial en la ficha | Cubierto | *Máquinas* y ficha de máquina |
| 2 | Personas: alta, edición y baja | Cubierto (además, reactivación) | *Personas* y ficha de persona |
| 3 | Registro de avería por cualquier persona: síntoma, prioridad, parada y cuándo empezó | Cubierto (solo personas activas) | *Averías → Registrar avería* |
| 4 | Ciclo abierta → asignada → en curso → resuelta → cerrada | Cubierto, con permisos por rol | Detalle de avería |
| 5 | Imputaciones de varios técnicos con fecha, horas y descripción; totales por avería, máquina y técnico | Cubierto | Detalle de avería, ficha de máquina y de técnico |
| 6 | Causa raíz y solución obligatorias para resolver | Cubierto (API, base de datos y formulario) | Formulario *Resolver* |
| 7 | Buscador del histórico por máquina, síntoma, causa o texto libre | Cubierto | *Histórico* |
| — | Modelo de datos orientativo | Cubierto, con ajustes justificados en el README | |
| — | Backend Python, BD relacional con migraciones, frontend usable | Cubierto (FastAPI, PostgreSQL + Alembic, React) | |
| — | Validaciones: obligatorios, fechas, transiciones, causa y solución | Cubierto | Secciones 7 y 8 de este plan |
| — | Datos de ejemplo: ≥5 máquinas, ≥5 personas, ≥10 averías en distintos estados con horas | Cubierto (6, 7 y 12) | `make seed` |
| — | Arranque con Docker Compose siguiendo el README | Cubierto | `make up` |
| — | Git con commits frecuentes y descriptivos | Cubierto | Historial del repositorio |

**Desviaciones documentadas en el README** (decisiones, no faltas):

- *Tipo/familia* y *ubicación* son texto libre obligatorio en vez de lista cerrada. El filtro busca
  por coincidencia parcial.
- *En avería* no se guarda: se deriva de las averías con parada sin resolver.
- Solo un responsable gestiona máquinas y personas. Una persona inactiva no puede registrar
  averías ("cualquier persona" se interpreta como "cualquier persona activa").
- Solo los técnicos imputan, siempre a su nombre, y solo con la avería en curso. Máximo 24 h por
  imputación.
- La identidad es simulada con el selector *Persona activa* (sin login).

**Huecos menores** (opcionales en el enunciado o no pedidos):

- El enunciado dice que el coste por hora "permite calcular el coste de cada avería". El coste se
  guarda en la persona, pero la aplicación no muestra el coste de la avería. La spec lo deja como
  opcional.
- No se pueden editar ni borrar imputaciones ni los datos de detección de una avería, ni reabrir
  una avería cerrada. El enunciado no lo pide y la spec lo excluye.

## 2. Preparación

1. Abre Docker Desktop y espera a que esté en marcha.
2. En una terminal, en la carpeta del proyecto:

   ```bash
   cp .env.example .env     # solo la primera vez
   make up
   make seed
   ```

3. Abre http://localhost:5173.

Para empezar de cero en cualquier momento: `docker compose down -v`, `make up` y, si quieres datos
demo, `make seed`.

**Datos demo que usa el plan**

| Personas | Rol |
| --- | --- |
| Rosa Martín Vidal, Diego Sanz Ortega | Responsable |
| Olga Pérez Ríos | Operaria |
| Tomás García León (mecánica), Teresa López Gil (eléctrica), Hugo Ruiz Navarro (hidráulica) | Técnico |
| Inés Moreno Cano | Técnica **inactiva** |

| Máquina | Situación inicial |
| --- | --- |
| PRE-001 Prensa | En avería: dos averías con parada (una abierta, una asignada a Hugo) |
| CNC-002 Centro de mecanizado | En avería: *Vibración del husillo* en curso (Tomás) con parada |
| ROB-003 Robot de soldadura | Operativa. *Error de comunicación* asignada a Teresa |
| CIN-004 Cinta transportadora | Operativa. Una avería abierta sin parada |
| COM-005 Compresor | Operativa. *Presión de aire baja* en curso (Hugo) |
| HOR-006 Horno | De baja, con dos averías cerradas |

La persona activa se cambia en el selector **Persona activa** de la cabecera. «Solo consulta» es
el modo sin actor.

## 3. Máquinas

| ID | Caso | Precondiciones | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- | --- |
| MAQ-01 | Listado | Datos demo | Ir a *Máquinas* | Se ven las 6 máquinas ordenadas por código, con tipo, ubicación, criticidad y estado. PRE-001 y CNC-002 en «En avería», HOR-006 «De baja» | ☐ |
| MAQ-02 | Filtro por estado | MAQ-01 | Estado = «En avería» | Solo PRE-001 y CNC-002. Con «De baja», solo HOR-006. Con «Todos», las 6 | ☐ |
| MAQ-03 | Filtro por tipo y ubicación | MAQ-01 | Tipo = «cnc», *Buscar*. Después Tipo vacío y Ubicación = «nave 2», *Buscar* | Primero solo CNC-002 (no distingue mayúsculas). Después CNC-002 y ROB-003 | ☐ |
| MAQ-04 | Filtros en la URL | MAQ-03 aplicado | Recargar la página (Cmd+R) | Los filtros y resultados se conservan | ☐ |
| MAQ-05 | Alta correcta | Persona activa: Rosa | *Nueva máquina*. Código « inj-007 », Nombre «Inyectora 200 t», Tipo «Inyectora», Ubicación «Nave 1», Criticidad «Alta», resto opcional relleno (fabricante, modelo, nº serie, puesta en marcha). Guardar | Se abre la ficha de **INJ-007** (mayúsculas y sin espacios), estado «Operativa», horas 0 y «Esta máquina no tiene averías registradas» | ☐ |
| MAQ-06 | Código duplicado | MAQ-05 | Nueva máquina con código «inj-007» | Error junto al campo Código: ya existe una máquina con ese código. No se crea | ☐ |
| MAQ-07 | Obligatorios vacíos | Rosa | Nueva máquina dejando Nombre con solo espacios, sin Tipo, Ubicación ni Criticidad | Errores junto a cada campo obligatorio. No se crea | ☐ |
| MAQ-08 | Edición | INJ-007 creada | En su ficha: *Editar*, cambiar Ubicación a «Nave 4» y Condición administrativa a «Fuera de servicio». *Guardar cambios* | Mensaje «Cambios guardados». La ficha y el listado muestran los nuevos valores y el estado «Fuera de servicio» | ☐ |
| MAQ-09 | Cancelar edición | INJ-007 | *Editar*, cambiar el nombre, *Cancelar* | No se guarda nada | ☐ |
| MAQ-10 | Baja bloqueada | Rosa | Ficha de PRE-001 | *Dar de baja* deshabilitado y el aviso «Solo se puede dar de baja cuando todas sus averías estén cerradas» | ☐ |
| MAQ-11 | Baja correcta | INJ-007 sin averías | *Dar de baja* → *Confirmar baja* | «Máquina dada de baja», estado «De baja», desaparecen *Editar* y *Dar de baja*, aviso «se conserva para consulta» | ☐ |
| MAQ-12 | Máquina de baja conserva historial | Datos demo | Ficha de HOR-006 | Estado «De baja», horas acumuladas 5,5 h, historial con sus 2 averías cerradas y enlace a cada detalle | ☐ |
| MAQ-13 | Ficha con historial y horas | Datos demo | Ficha de PRE-001 | Historial con averías de todos los estados (abierta, asignada, cerrada). Horas acumuladas 2 h | ☐ |
| MAQ-14 | Sin permiso (operario/técnico) | Persona activa: Olga | Ir a *Máquinas* y abrir una ficha | No aparecen *Nueva máquina*, *Editar* ni *Dar de baja*. Aviso de modo en la cabecera: máquinas y personas solo se consultan | ☐ |
| MAQ-15 | Solo consulta | Persona activa: «Solo consulta» | Ir a *Máquinas* | Se puede consultar todo, sin acciones de gestión. Aviso «Modo consulta» | ☐ |

## 4. Personas

| ID | Caso | Precondiciones | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- | --- |
| PER-01 | Listado y filtros | Datos demo | *Personas*. Probar Rol = «Técnico» y Vigencia = «Inactivas» | Las 7 personas. Con Rol técnico: Tomás, Teresa, Hugo e Inés. Con inactivas: solo Inés. *Limpiar* vuelve a todas | ☐ |
| PER-02 | Alta de técnico | Rosa | *Nueva persona*: «Laura Gómez Pardo», rol Técnico, especialidad Neumática, email «Laura.Gomez@Ejemplo.com», teléfono «611 222 333», coste «42,75». Guardar | Ficha creada, activa, email en minúsculas, coste 42,75 €. Aparece en el selector *Persona activa* | ☐ |
| PER-03 | Alta de operario sin opcionales | Rosa | Nueva persona solo con nombre y rol Operario | Se crea. Especialidad, email, teléfono y coste vacíos | ☐ |
| PER-04 | Email inválido | Rosa | Nueva persona con email «laura@» | Error junto al campo Email. No se crea | ☐ |
| PER-05 | Coste inválido | Rosa | Coste «-5» y después «12,345» | Error junto al campo coste en ambos casos | ☐ |
| PER-06 | Obligatorios | Rosa | Nombre con solo espacios y sin rol | Errores junto a Nombre y Rol | ☐ |
| PER-07 | Edición | Laura creada | *Editar*: teléfono «699 000 111», especialidad Hidráulica. *Guardar cambios* | Cambios visibles en la ficha y el listado | ☐ |
| PER-08 | Baja correcta | Laura sin averías asignadas | *Dar de baja* → *Confirmar baja* | «Persona dada de baja», estado inactiva, botón *Reactivar*. Desaparece del selector *Persona activa* | ☐ |
| PER-09 | Reactivar | PER-08 | *Reactivar* | «Persona reactivada». Vuelve al selector | ☐ |
| PER-10 | Baja bloqueada de técnico con trabajo | Rosa | Ficha de Hugo (tiene averías asignadas/en curso) | *Dar de baja* deshabilitado con el motivo «Tiene N avería(s) asignadas o en curso. Reasígnalas antes de darla de baja» | ☐ |
| PER-11 | Cambio de rol bloqueado | Rosa | Ficha de Hugo → *Editar* → Rol «Operario» → Guardar | Error: no se puede cambiar el rol de un técnico con averías a su cargo | ☐ |
| PER-12 | Inactiva conserva historial | Datos demo | Ficha de Inés | Inactiva, horas imputadas 5,5 h. Sus averías cerradas siguen mostrándola como técnica | ☐ |
| PER-13 | Horas por técnico | Datos demo | Ficha de Tomás | «Horas imputadas» = 1,25 + 1,5 + 1,5 = 4,25 h y «Averías a su cargo» con su recuento | ☐ |
| PER-14 | Sin permiso | Persona activa: Tomás | *Personas* y una ficha | Sin *Nueva persona*, *Editar*, *Dar de baja* ni *Reactivar* | ☐ |

## 5. Base vacía y primer responsable

| ID | Caso | Precondiciones | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- | --- |
| BAS-01 | Pantalla de primer responsable | `docker compose down -v` y `make up`, **sin** `make seed` | Abrir http://localhost:5173 | Pantalla «Primer responsable» con el formulario de persona y el rol fijado a responsable | ☐ |
| BAS-02 | Validación en el primer alta | BAS-01 | Enviar con nombre vacío o email inválido | Errores por campo. No se crea | ☐ |
| BAS-03 | Alta del primer responsable | BAS-01 | Rellenar nombre y *Crear responsable* | Se entra en la aplicación con esa persona como *Persona activa*. Bandeja de averías vacía | ☐ |
| BAS-04 | Recorrido desde cero | BAS-03 | Crear una máquina, un técnico y un operario, y hacer el flujo de la sección 6 con ellos | Todo funciona sin datos demo | ☐ |
| BAS-05 | Sin técnicos activos | BAS-03 con una avería abierta y ningún técnico | Detalle de la avería como responsable | El selector de técnico explica «No hay ningún técnico activo» y enlaza a *Da de alta un técnico* y a *Personas* | ☐ |
| BAS-06 | Último responsable | BAS-03 con un único responsable | En su ficha: *Dar de baja* y, aparte, *Editar* cambiando su rol | Ambos rechazados: no se puede dejar la aplicación sin responsable activo | ☐ |
| BAS-07 | Carga demo idempotente | Con datos demo ya cargados | Ejecutar `make seed` otra vez | La terminal informa que todo «ya existía». No aparecen duplicados | ☐ |
| BAS-08 | Estado del sistema | Cualquiera | Ir a *Estado* | Base de datos «ok» y migración `0001` | ☐ |

## 6. Flujo completo de una avería por rol

Recorrido principal de la spec. Ejecutar en orden sobre una avería nueva.

| ID | Caso | Persona activa | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- | --- |
| FLU-01 | Registrar parada | Olga (operaria) | *Averías → Registrar avería*. Máquina CIN-004, Detección = hace 1 hora, Título «Rodillo bloqueado en el tramo 3», «¿Ha parado la máquina?» = Sí, Tipo de fallo Mecánico, Prioridad Alta, Síntoma «El rodillo no gira y la cinta patina». *Registrar avería* | Detalle con número `AV-<año>-NNNN`, estado **Abierta**, reportada por Olga, sin técnico. Sin botones de acción para Olga | ☐ |
| FLU-02 | Máquina en avería | — | Abrir *Máquinas* | CIN-004 aparece «En avería» | ☐ |
| FLU-03 | Bandeja | — | *Averías* | La avería aparece arriba (orden por detección). Filtros por estado, prioridad y máquina la encuentran | ☐ |
| FLU-04 | Asignar | Rosa | En el detalle: Técnico = Tomás, *Asignar* | Estado **Asignada**, técnico Tomás. Rosa ve *Reasignar a* | ☐ |
| FLU-05 | Iniciar | Tomás | *Iniciar trabajo* | Estado **En curso**. Aparecen el formulario de imputación y *Resolver* | ☐ |
| FLU-06 | Imputar asignado | Tomás | Imputar: fecha hoy, horas «1,25», trabajo «Desmontaje del rodillo». *Imputar horas* | Fila en *Imputaciones* con Tomás y 1,25 h. Total 1,25 h | ☐ |
| FLU-07 | Imputar colaborador | Hugo | En la misma avería, imputar «0,75» h, «Ajuste de tensión» | Segunda fila con Hugo. Total **2 h**. Hugo **no** ve *Resolver* | ☐ |
| FLU-08 | Resolver | Tomás | *Resolver*. Causa raíz «Rodamiento gripado por falta de engrase», Solución «Sustitución del rodamiento y engrase del tramo», Repuestos «ROD-6204 x2», Tipo «Sustitución», Recomendación «Engrasar cada 200 h». *Marcar como resuelta* | Estado **Resuelta** con hora de resolución y toda la documentación. *Tiempo de parada* calculado en horas (≈ 1 h + lo transcurrido) | ☐ |
| FLU-09 | Máquina recupera estado | — | *Máquinas* | CIN-004 vuelve a «Operativa» | ☐ |
| FLU-10 | Cerrar | Rosa | *Cerrar y validar* → *Confirmar cierre* | Estado **Cerrada**, «Validada por» Rosa y fecha de cierre. Sin más acciones | ☐ |
| FLU-11 | Totales | — | Ficha de CIN-004, de Tomás y de Hugo | CIN-004 suma 2 h. Tomás sube 1,25 h y Hugo 0,75 h respecto a antes del flujo | ☐ |
| FLU-12 | Reasignar en curso | Rosa | Avería demo *Presión de aire baja en la red* (COM-005, en curso, Hugo): *Reasignar a* Teresa | Sigue **En curso**, técnico Teresa. La imputación de Hugo se conserva a su nombre | ☐ |
| FLU-13 | Reasignar al mismo | Rosa | Reasignar al técnico que ya la tiene | No se ofrece o da error «mismo técnico» | ☐ |
| FLU-14 | Avería sin parada | Olga | Registrar en ROB-003 con «No, sigue funcionando» y resolverla siguiendo el flujo | La máquina no pasa a «En avería». Tiempo de parada = 0 h | ☐ |

## 7. Permisos y acciones prohibidas

| ID | Caso | Persona activa | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- | --- |
| PRM-01 | Operario no asigna | Olga | Detalle de *La cinta se detiene de forma intermitente* (abierta) | No ve el selector de técnico ni ningún botón de acción | ☐ |
| PRM-02 | Técnico no asignado no inicia | Tomás | Detalle de *Error de comunicación con el controlador* (asignada a Teresa) | No ve *Iniciar trabajo* | ☐ |
| PRM-03 | Responsable no inicia ni resuelve | Rosa | Avería asignada y avería en curso | Solo ve *Reasignar a*. No ve *Iniciar trabajo*, *Resolver* ni el formulario de imputación | ☐ |
| PRM-04 | Técnico no cierra | Tomás | Avería *Hilo de soldadura atascado en la sirga* (resuelta) | No ve *Cerrar y validar* | ☐ |
| PRM-05 | Operario no cierra | Olga | Avería resuelta | Sin acciones | ☐ |
| PRM-06 | No se asigna a inactiva | Rosa | Avería abierta → selector de técnico | Inés no aparece en la lista (solo técnicos activos) | ☐ |
| PRM-07 | No se asigna a no técnicos | Rosa | Selector de técnico | Solo aparecen técnicos, no operarios ni responsables | ☐ |
| PRM-08 | Imputación fuera de «en curso» | Teresa | Avería asignada a ella sin iniciar | No hay formulario de imputación | ☐ |
| PRM-09 | Avería cerrada solo lectura | Cualquiera | Detalle de *Pérdida de presión en el circuito hidráulico* | Sin acciones. Documentación completa visible | ☐ |
| PRM-10 | Persona inactiva fuera del selector | — | Abrir *Persona activa* | Inés no aparece | ☐ |
| PRM-11 | Solo consulta | «Solo consulta» | Recorrer averías, máquinas y personas | Todo es visible, ninguna acción de escritura | ☐ |
| PRM-12 | Rechazo desde la API (opcional) | — | En http://localhost:8000/docs, `POST /api/v1/incidents/{id}/close` sobre una avería resuelta con `X-Actor-Id` de Olga; y `POST …/resolve` sobre una avería abierta con el técnico | 403 `actor_role_forbidden` y 409 `incident_invalid_transition` (salto de estado) | ☐ |

Los IDs de persona se ven en la URL de su ficha (`/personas/<id>`) y los de avería en `/averias/<id>`.

## 8. Validaciones y errores

| ID | Caso | Persona activa | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- | --- |
| VAL-01 | Registro sin obligatorios | Olga | *Registrar avería* sin rellenar nada | Errores junto a máquina, detección, título, parada, tipo de fallo, prioridad y síntoma | ☐ |
| VAL-02 | Detección futura | Olga | Detección = mañana | Error junto a *Detección*: no puede ser futura | ☐ |
| VAL-03 | Máquina de baja | Olga | Abrir el selector de máquina al registrar | HOR-006 no se ofrece (o da error de máquina de baja) | ☐ |
| VAL-04 | Horas cero | Tomás | En *Vibración del husillo a altas revoluciones* (en curso), imputar «0» | Error junto a Horas | ☐ |
| VAL-05 | Horas negativas | Tomás | Imputar «-1» | Error junto a Horas | ☐ |
| VAL-06 | Tramo no válido | Tomás | Imputar «0,10» y después «1,3» | Error: tramos de 0,25 h | ☐ |
| VAL-07 | Más de 24 h | Tomás | Imputar «25» | Error junto a Horas | ☐ |
| VAL-08 | Fecha anterior a la detección | Tomás | Esa avería se detectó hace 2 días. Fecha de trabajo = hace 3 días | Error: no puede ser anterior a la detección | ☐ |
| VAL-09 | Fecha futura | Tomás | Fecha de trabajo = mañana | Error: no puede ser futura | ☐ |
| VAL-10 | Imputación sin descripción | Tomás | Horas válidas y trabajo vacío o solo espacios | Error junto a *Trabajo realizado* | ☐ |
| VAL-11 | Coma y punto decimal | Tomás | Imputar «0,5» y después «0.5» | Ambas se aceptan como 0,5 h | ☐ |
| VAL-12 | Resolver sin causa | Tomás | *Resolver* con causa raíz vacía o solo espacios | Error junto a *Causa raíz*. Sigue en curso | ☐ |
| VAL-13 | Resolver sin solución | Tomás | *Resolver* con solución vacía | Error junto a *Solución aplicada*. Sigue en curso | ☐ |
| VAL-14 | Envíos deshabilitados | Cualquiera | Pulsar un botón de guardar dos veces rápido | El botón muestra «Guardando…»/«Enviando…» y no crea duplicados | ☐ |
| VAL-15 | Recurso inexistente | — | Abrir http://localhost:5173/averias/999999 y /maquinas/999999 | «La avería no existe» / «La máquina no existe» | ☐ |
| VAL-16 | Página inexistente | — | http://localhost:5173/xyz | «Página no encontrada» | ☐ |
| VAL-17 | Backend caído | — | `docker compose stop backend` y recargar. Después `docker compose start backend` | Mensaje de error con opción de reintentar y la página de estado. Al volver el backend, reintentar funciona | ☐ |

## 9. Paradas simultáneas

| ID | Caso | Persona activa | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- | --- |
| PAR-01 | Dos paradas | Datos demo | Ficha de PRE-001 | «En avería» con dos averías con parada (*Fuga de aceite en el latiguillo del cojín*, abierta, y *Ruido metálico en la bomba hidráulica*, asignada a Hugo) | ☐ |
| PAR-02 | Resolver solo una | Hugo, Rosa | Hugo inicia y resuelve *Ruido metálico…* (con causa y solución) | PRE-001 **sigue** «En avería» | ☐ |
| PAR-03 | Cambiar condición durante la parada | Rosa | Editar PRE-001: condición «Fuera de servicio» | Se guarda, pero el estado visible sigue «En avería» | ☐ |
| PAR-04 | Resolver la segunda | Rosa, Tomás | Rosa asigna *Fuga de aceite…* a Tomás; Tomás inicia y resuelve | PRE-001 pasa a «Fuera de servicio» (la condición fijada en PAR-03) | ☐ |

## 10. Histórico de reparaciones

| ID | Caso | Pasos | Resultado esperado | ✓ |
| --- | --- | --- | --- | --- |
| HIS-01 | Listado | Ir a *Histórico* | Solo averías resueltas y cerradas, la más reciente primero. Cada tarjeta muestra máquina, síntoma, causa, solución, repuestos y enlace al detalle | ☐ |
| HIS-02 | Texto libre en la solución | Buscar = «junta tórica», *Buscar*. Repetir con «PURGA» | Aparece *Pérdida de presión en el circuito hidráulico* (PRE-001) en ambos casos | ☐ |
| HIS-03 | Por máquina | Máquina = HOR-006 | Sus dos averías cerradas, aunque la máquina esté de baja | ☐ |
| HIS-04 | Por síntoma | Síntoma = «alarma» | *Alarma de sobretemperatura en el cabezal* (CNC-002) y *Resistencia quemada en la zona 2* (HOR-006) | ☐ |
| HIS-05 | Por causa raíz | Causa raíz = «virutas» | *Alarma de sobretemperatura en el cabezal* | ☐ |
| HIS-06 | Filtros combinados | Máquina = PRE-001 y Buscar = «termopar» | Sin resultados: los filtros se combinan con AND. Mensaje «Ninguna reparación documentada coincide…» | ☐ |
| HIS-07 | Abiertas no aparecen | Buscar = «latiguillo» (si no se resolvió en PAR-04) | Sin resultados | ☐ |
| HIS-08 | Avería nueva aparece | Tras FLU-08, buscar «rodamiento» | Aparece la avería del flujo con su documentación | ☐ |
| HIS-09 | Enlace al detalle | Pulsar el enlace de una tarjeta | Detalle completo: detección, asignación, resolución, validación, horas y parada | ☐ |
| HIS-10 | Caracteres especiales | Buscar = «%» y después «_» | No devuelve todo: se buscan literalmente | ☐ |
| HIS-11 | Filtros en la URL | Aplicar filtros y recargar | Se conservan | ☐ |

## 11. Comprobaciones automáticas (opcional)

Si quieres complementar la prueba manual:

```bash
make walkthrough   # recorrido completo contra la API con rechazos y totales
make verify        # arranque desde base vacía, doble seed y recorrido en un proyecto aparte
```

`make walkthrough` deja una máquina `REC-<marca>` y una avería cerrada en la base de desarrollo.

## Observaciones

| ID del caso | Qué pasó | Captura / notas |
| --- | --- | --- |
| | | |
