# Preguntas relevadas y decisiones de alcance — Stock Simple

> Versión 1.1 · Estado: sin preguntas pendientes para el MVP · Última actualización: 2026-11-16

Este documento conserva las preguntas que se analizaron antes de implementar. Las respuestas son decisiones adoptadas por el equipo para delimitar el MVP académico; no se presentan como respuestas textuales de un cliente externo.

La prioridad expresa el impacto que hubiera tenido dejar cada pregunta sin resolver. Todas las preguntas que aparecen abajo están cerradas. Las funciones excluidas son decisiones de alcance y no tareas pendientes.

| Prioridad | ID | Pregunta que se debía resolver | RN / HU afectadas | Impacto si no se resolvía | Decisión adoptada | Estado / destino |
|---|---|---|---|---|---|---|
| Crítica | P-001 | ¿Quién puede usar el sistema y cómo se protege la información? | RN-18; HU-01 a HU-09 | Sin usuarios ni permisos definidos, una demo pública podría exponer y permitir modificar datos sin control. | El MVP no tiene autenticación, roles ni sesiones. Se admite una demo pública solo para evaluación académica con datos ficticios/de prueba; no se usa para datos reales ni producción. | Cerrada · D-002; `spec.md` §2 |
| Alta | P-002 | ¿Se necesita registrar cada entrada, salida o ajuste de stock como historial? | RN-04 a RN-07; HU-06, HU-07 | Sin respuesta no se puede determinar si el sistema debe auditar movimientos y motivos o mantener únicamente la cantidad actual. | No se incluye un libro de movimientos de stock. Se conserva stock actual y el historial de presupuestos. | Cerrada · D-014; fuera de alcance |
| Alta | P-003 | ¿Se requiere importar o exportar el catálogo mediante CSV? | RN-01, RN-02, RN-17; HU-01, HU-02 | Cambia los formatos de intercambio, validaciones por lote y tratamiento de errores parciales. | No se importa ni exporta CSV en el MVP. El catálogo se administra desde la interfaz y la API. | Cerrada · `spec.md` §4 |
| Alta | P-006 | ¿El frontend y el backend se publicarán en orígenes separados? | Requisitos no funcionales de seguridad y comunicación; HU-01 a HU-09 | Si se separan, el navegador bloquearía las respuestas cross-origin sin una política CORS explícita y una política abierta podría exponer la API a cualquier sitio. | La arquitectura vigente sirve frontend y API desde el mismo origen, con rutas relativas `/api`; no requiere CORS. Si se separan, se habilitará una allowlist exacta del frontend y nunca `*`. | Cerrada · D-003; `plan.md` §4.1 |
| Media | P-004 | ¿El umbral de stock bajo debe poder configurarse por producto? | RN-08, RN-11; HU-07 | Sin un umbral definido, el indicador de reposición tendría resultados arbitrarios. | Se utiliza un umbral único fijo: stock menor o igual que cinco unidades. | Cerrada · D-009; RN-08 y RN-11 |
| Media | P-005 | ¿Las categorías deben administrarse como registros independientes? | RN-02, RN-12, RN-13; HU-02, HU-03, HU-05 | Implicaría CRUD de categorías, relaciones, restricciones de borrado y migraciones. | La categoría es un texto reutilizable y normalizado dentro de cada producto; no tiene entidad ni pantalla propia. | Cerrada · D-005; RN-02 |

## Estado de cierre

P-001 a P-006 están respondidas y documentadas. **No quedan preguntas funcionales ni técnicas pendientes que bloqueen el MVP.** La demo pública sin autenticación es una excepción exclusivamente académica: solo debe usarse con datos ficticios/de prueba. Cambiar el alcance exige registrar una nueva decisión y actualizar `spec.md` y `plan.md` antes de desarrollar.

## Historial de cambios

- [cambio] 2026-10-22 — Se registran funcionalidades consideradas y excluidas del alcance inicial.
- [cambio] 2026-11-15 — Se cierra el documento como catálogo de decisiones de alcance futuro; se elimina cualquier formulación que pudiera interpretarse como trabajo pendiente del MVP.
- [cambio] 2026-11-16 — Se ordenan las preguntas por prioridad, se explicitan reglas/historias e impacto y se incorpora la decisión de demo académica y origen/CORS.
