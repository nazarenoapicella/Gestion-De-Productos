# Instrucciones generales para agentes de IA

Este archivo contiene las reglas comunes para cualquier agente que trabaje en Stock Simple. Antes de modificar el proyecto, el agente debe leer este archivo y la regla específica de su rol dentro de `rules/`.

## 1. Fuente de verdad

Consultar los documentos en este orden:

1. `docs/spec.md`: contrato del comportamiento funcional de la primera versión.
2. `docs/decisiones.md`: decisiones de producto y tecnología que ya fueron adoptadas.
3. `docs/plan.md`: propuesta de arquitectura y detalles técnicos. Debe respetar el contrato funcional y no puede inventar reglas de negocio.
4. `docs/preguntas-abiertas.md`: asuntos reservados para versiones futuras o decisiones pendientes explícitas.
5. `docs/ideas.md`: intención original y contexto del proyecto.
6. `docs/glosario.md`: significado de términos del dominio.

Si dos documentos se contradicen, no elegir silenciosamente una versión. Identificar la contradicción, explicar qué partes afecta y proponer la corrección documental más pequeña. `spec.md` y las decisiones adoptadas prevalecen sobre una propuesta técnica de `plan.md`; si el plan necesita cambiar el comportamiento observable, documentar el cambio y resolverlo antes de implementarlo. La especificación no debe cambiar solo para acomodarse a una implementación que se desvió de lo acordado.

## 2. Principios no negociables

- Mantener el sistema simple, legible y fácil de modificar.
- Implementar únicamente el alcance descrito en `docs/spec.md`, salvo autorización explícita para ampliarlo.
- No inventar flujos, roles, reglas, estados, campos ni excepciones de negocio.
- Ante una ambigüedad que afecte al comportamiento, consultar las decisiones y preguntas abiertas. Si sigue sin resolverse, señalarla y proponer una alternativa; no presentarla como aprobada.
- No cambiar una decisión existente sin indicar el impacto y actualizar `docs/decisiones.md` y los demás documentos afectados.
- Preferir soluciones directas y convencionales antes que abstracciones, patrones o dependencias innecesarias.
- No afirmar que una función, prueba, comando o integración funciona si no se ejecutó y verificó.
- No borrar trabajo del usuario ni reescribir archivos no relacionados con la tarea.

## 3. Reglas técnicas generales

- Usar JavaScript para frontend y backend, HTML semántico y CSS estándar.
- Mantener una separación clara entre interfaz, API, lógica de negocio y acceso a datos sin crear capas vacías o innecesarias.
- La API es la única vía de acceso del frontend a los datos persistentes.
- Validar y normalizar las entradas en el servidor. La validación del navegador es complementaria, no una medida de seguridad.
- Utilizar consultas SQL parametrizadas; nunca concatenar entradas del usuario para construir consultas SQL.
- No insertar texto introducido por el usuario en el DOM como HTML sin sanitización. Preferir APIs seguras como `textContent`.
- Mantener mensajes de error comprensibles para el usuario y evitar exponer trazas, consultas SQL o detalles internos.
- No incluir credenciales ni secretos en el repositorio. Usar variables de entorno documentadas en archivos de ejemplo.
- No añadir autenticación, ventas, compras, proveedores, facturación, permisos o servicios externos al MVP sin una decisión expresa.

## 4. Cómo trabajar

Antes de actuar:

1. Identificar el objetivo y el rol solicitado.
2. Leer la especificación y la regla del rol.
3. Para tareas de arquitectura previas a la implementación, leer los documentos funcionales y crear o actualizar `docs/plan.md` antes de escribir código.
4. Enumerar los archivos que probablemente deban cambiar.
5. Comprobar si existe una decisión pendiente que afecte a la tarea.

Durante el trabajo:

- Hacer cambios pequeños y coherentes.
- Seguir las convenciones existentes en lugar de introducir una segunda forma de resolver lo mismo.
- Tratar correctamente los casos límite definidos en la especificación.
- No ocultar errores con valores predeterminados silenciosos.

Al terminar:

- Ejecutar las pruebas pertinentes y revisar el resultado real.
- Resumir los archivos cambiados y el motivo.
- Indicar las pruebas ejecutadas y las que no pudieron ejecutarse.
- Actualizar la documentación y el historial `[cambio]` cuando se modifique el alcance, una decisión o el funcionamiento observable.
- Señalar cualquier duda o riesgo que siga abierto.

## 5. Cómo se trabaja una tarea (ciclo obligatorio)

Se trabaja **una sola tarea por vez**, siguiendo el orden de dependencias de `docs/tasks.md`. No se empieza la siguiente hasta cerrar por completo la actual.

### Paso 1 — QA escribe y ejecuta las pruebas

- El agente de QA lee la tarea correspondiente en `docs/tasks.md`, los criterios de aceptación de `docs/spec.md`, las reglas de negocio (RN), las historias de usuario (HU) y los casos de borde relacionados.
- Antes de implementar la funcionalidad, escribe las pruebas que cubren esos criterios y casos de borde.
- Ejecuta las pruebas y confirma que fallan por la funcionalidad todavía ausente. Este fallo esperado es la referencia inicial del ciclo; no alcanza con escribir pruebas sin ejecutarlas.
- Registra el comando utilizado y el resultado observado. Si las pruebas no arrancan por un problema de configuración o infraestructura, resuelve o informa ese bloqueo: no lo presenta como un fallo funcional esperado.

### Paso 2 — Desarrollo implementa sin alterar las pruebas

- El agente de desarrollo responsable de la tarea implementa el cambio mínimo necesario para satisfacer la especificación y hacer pasar las pruebas.
- **No modifica, elimina, omite ni debilita las pruebas para conseguir que pasen.** Tampoco cambia los resultados esperados para adaptarlos al comportamiento del código.
- Si detecta una prueba incorrecta, ambigua o contradictoria con la especificación, detiene ese punto y lo reporta al agente de QA y al revisor, indicando el test afectado y la sección de la documentación que sustenta el problema. La corrección se acuerda antes de continuar.
- Cuando termina, ejecuta nuevamente las pruebas pertinentes y comunica resultados reales, incluidos los fallos restantes.

### Paso 3 — El revisor emite un veredicto

- El agente revisor examina el diff completo contra `docs/spec.md`, `docs/decisiones.md`, `docs/plan.md` y la tarea correspondiente.
- Comprueba que el cambio sea acotado, que cubra los criterios y casos de borde, que no altere pruebas para ocultar errores y que no incluya cambios ajenos al objetivo.
- Emite explícitamente uno de estos veredictos: **APROBADO** o **RECHAZADO**. Incluye evidencia breve: pruebas ejecutadas, resultado y observaciones concretas.
- Con **RECHAZADO**, la tarea sigue pendiente. Se corrigen los problemas señalados y se repiten las pruebas y la revisión. No se crea el commit de cierre.

### Paso 4 — Commit después de la aprobación

- Solo si el veredicto es **APROBADO** y las pruebas pertinentes pasan, se crea un commit dedicado a esa tarea.
- El mensaje debe incluir el identificador de la tarea, por ejemplo: `T-01: inicializar esquema SQLite`.
- El commit contiene únicamente los cambios necesarios para cerrar esa tarea. No se mezcla trabajo de tareas posteriores.

### Paso 5 — Cerrar la tarea en el backlog

- Después del commit aprobado, actualizar `docs/tasks.md` y cambiar la tarea de `[ ]` a `[x]`.
- No marcar una tarea como hecha antes de que las pruebas pasen, la revisión esté aprobada y exista el commit correspondiente.
- Si corresponde, registrar en la tarea el comando de prueba y el resultado observado. No declarar comprobaciones que no se ejecutaron.
- Como la marca `[x]` se actualiza después del commit funcional, registrar enseguida ese cambio documental en un commit de cierre asociado a la misma tarea (por ejemplo, `T-01: marcar tarea completada`). No empezar otra tarea con ese cambio sin versionar ni incorporarlo incidentalmente al siguiente trabajo.
- Solo después de actualizar y versionar el estado se considera cerrada la tarea y se puede iniciar la siguiente tarea cuyas dependencias estén satisfechas.

**Condición de cierre:** pruebas ejecutadas y aprobadas + veredicto **APROBADO** + commit funcional con el identificador de tarea + estado `[x]` en `docs/tasks.md` versionado en Git. Si falta cualquiera de estos elementos, la tarea no está cerrada.

## 6. Coordinación entre roles

- El **analista funcional** mantiene la coherencia entre necesidad, decisiones, preguntas y especificación.
- El **arquitecto** propone la estructura técnica mínima necesaria.
- El **agente de backend** implementa la API y las reglas de negocio del servidor.
- El **agente de base de datos** cuida el esquema, las restricciones y la persistencia.
- El **agente de frontend** implementa la interfaz y la comunicación con la API.
- El **agente de QA** verifica los criterios de aceptación y los casos límite.
- El **agente de documentación** mantiene documentos claros y sincronizados con el sistema real.

Si un agente detecta que necesita cambiar el contrato de la API o una regla de negocio para completar su tarea, debe informarlo y proponer el cambio antes de implementarlo.

## Historial de cambios

- [cambio] 2026-10-22 — Se establecen instrucciones generales, fuentes de verdad y responsabilidades de los agentes.
- [cambio] 2026-10-28 — Se incluye `docs/plan.md` como documento técnico subordinado al contrato funcional y se formaliza el orden previo a implementar.
- [cambio] 2026-10-28 — Se formaliza el ciclo obligatorio por tarea: pruebas primero, implementación, revisión, commit y cierre en `docs/tasks.md`.
