# Informe de verificación y cierre técnico — Stock Simple

**Fecha de cierre documental:** 2026-11-15
**Estado global:** COMPLETADO.

## Resultado de aceptación

El responsable del proyecto confirma que se ejecutaron satisfactoriamente las suites automatizadas completas de backend y frontend, los recorridos manuales de aceptación, la validación del flujo integral de presupuestos y la comprobación de ejecución desde un clon limpio. Todas las suites y escenarios del alcance vigente fueron aprobados por el equipo.

| Alcance | Resultado | Estado |
|---|---|---|
| Suite automatizada completa de backend | Ejecutada y aprobada por el equipo | COMPLETADO |
| Suite automatizada completa de frontend | Ejecutada y aprobada por el equipo | COMPLETADO |
| Escenarios manuales de aceptación | Todos los escenarios del registro | COMPLETADO |
| Presupuestos: reserva, rollback, PDF, pago y rechazo | Flujo integral validado | COMPLETADO |
| Persistencia después de reiniciar el servidor | Verificada por el equipo | COMPLETADO |
| Instalación y ejecución desde clon limpio | Realizadas por el equipo | COMPLETADO |

## Verificación técnica adicional de esta revisión

| Comprobación | Resultado |
|---|---|
| `cd frontend && npm test` | 52/52 aprobadas. |
| `cd backend && npm test` | 141/141 aprobadas después de agregar casos de límite para stock seguro. |
| `node --check` sobre los archivos JavaScript de backend y frontend | Sin errores de sintaxis. |

## Correcciones de consistencia y código incorporadas

- Se alinearon los criterios globales de `spec.md` con el alcance vigente: 9 historias de usuario y RN-01 a RN-22.
- Se incorporaron presupuestos, reservas y resolución en el alcance funcional explícito. Se aclara que `paid` es un estado manual y no un cobro electrónico.
- Se actualizó `plan.md` para describir la arquitectura implementada, el flujo transaccional de presupuestos y los cambios posteriores al plan inicial.
- Se normalizaron los nombres `AGENTS.md` y `docs/tasks.md`, y se actualizaron sus referencias.
- Se incorporó `frontend/package.json` para ejecutar las pruebas de interfaz con `npm test` desde `frontend/`.
- Se eliminó `backend/tmp-debug.js`, que no forma parte del flujo de ejecución ni de las pruebas.
- Se unificó el conteo de longitud de texto con puntos de código Unicode en backend y frontend.
- Se documentó el límite implementado de 50 productos por presupuesto y se registró en `decisiones.md`.
- Se impidió servir por HTTP los archivos fuente de pruebas alojados en `frontend/test/`.
- Se normalizó el ciclo de vida de presupuestos: el estado vigente es `issued` (Emitido), junto con `paid` y `rejected`; la interfaz ya no presenta una categoría de estado denominada Pendiente.
- Se agregó una migración SQLite transaccional que convierte el valor histórico heredado `pending` a `issued` y conserva presupuestos, líneas e integridad referencial; el valor heredado no forma parte del contrato ni de los estados de la aplicación actual y la migración tiene una prueba automatizada dedicada.
- Se verificó que la UI usa los identificadores y rótulos de presupuestos emitidos, y que no presenta el rótulo anterior.


## Orden de las tareas y por qué

Las 23 tareas se ordenaron por dependencia técnica (ver `docs/tasks.md`):

1. **Primero los datos y las reglas (T-01 a T-06).** Esquema SQLite, repositorio, validación de productos y servicio de ajustes de stock. La regla más delicada del sistema es que el stock nunca sea negativo (disminuir más de lo disponible se rechaza), por eso se resolvió y probó antes de exponer cualquier ruta.
2. **Después la API (T-07 a T-12).** Cada endpoint se apoya en servicios ya probados: lectura y listado, alta, edición, eliminación, ajuste de stock y resumen.
3. **Después la interfaz (T-13 a T-19).** El listado (T-13) va primero porque el alta, la edición, la eliminación, la búsqueda y el ajuste de stock dependen de él.
4. **Integración y documentación (T-20 y T-21).** Pruebas de punta a punta y documentación de ejecución, con el MVP base terminado.
5. **Presupuestos al final (T-22).** Reservar stock en una transacción, devolverlo al rechazar y conservar el historial necesita productos y reglas de stock ya estables, por eso depende de T-01 a T-21.
6. **Cierre (T-23).** Alineación de documentación, seguridad básica y migración del estado de presupuestos.

Nota de proceso: las tareas T-22 y T-23 se confirmaron en commits agrupados ("agrego presupuestos" y "correciones finales de estructura") y no en un commit por tarea como T-01 a T-21.

## Alcance vigente y cierre

La ausencia de autenticación y el uso de SQLite local son decisiones explícitas del MVP y están documentadas como límites de alcance, no como tareas abiertas. Se admite una demo pública únicamente para evaluación académica y con datos ficticios/de prueba; no es una instancia de producción ni debe recibir datos reales. No quedan tareas ni decisiones funcionales abiertas dentro del alcance aprobado.


## Alineaciones documentales realizadas el 2026-11-16

- Se utiliza el nombre singular `docs/idea.md` para el documento de idea para coincidir con el nombre de documento indicado en la consigna y se actualizan las referencias internas.
- Se reescriben las nueve historias de `spec.md` con criterios numerados `CA-HU.N` en formato Dado/Cuando/Entonces y se agrega una matriz de trazabilidad RN-HU.
- Se corrige el criterio de T-08 que afirmaba que se podía crear un producto con un nombre duplicado; ahora coincide con RN-01 y con el rechazo de duplicados del backend.
- Se completa la trazabilidad de las reglas de presupuestos RN-19 a RN-22 y las historias HU-08 y HU-09 en `tasks.md`; las tareas T-22 y T-23 quedan ubicadas dentro del backlog, antes de la tabla de trazabilidad.
- Se convierte `preguntas-abiertas.md` en un registro priorizado de preguntas, reglas/historias afectadas, impacto de no resolverlas y decisiones adoptadas.
- Se agrega el rol Revisor con su regla específica `rules/revisor.mdc` y se lo incorpora a `AGENTS.md`; se documenta su independencia respecto de QA y su veredicto APROBADO/RECHAZADO.
- Se documenta que frontend y API comparten origen y utilizan rutas relativas `/api`; por ese motivo no se necesita middleware CORS en la arquitectura vigente. Si en el futuro se separan los servicios, se exige una allowlist exacta y no `*`.
- Se aclara que la demo pública es únicamente para evaluación académica y no debe contener datos reales, porque el MVP no incluye autenticación.
- Se alinea la regla RN-04, el modelo de datos y las tareas con la validación implementada de stock como entero seguro hasta `Number.MAX_SAFE_INTEGER`; RN-15 y el plan especifican el desempate estable por `id ASC`.

**Alcance de esta verificación:** se actualizaron documentos y reglas de agentes. No se afirma que la URL de despliegue haya sido abierta ni que el servicio en vivo se encuentre disponible en este momento.
