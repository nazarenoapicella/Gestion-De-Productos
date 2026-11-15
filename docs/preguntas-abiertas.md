# Decisiones de alcance futuro — Stock Simple

**Estado del documento:** CERRADO PARA EL MVP.  
**Estado de las decisiones:** todas las cuestiones de esta lista están resueltas como exclusiones explícitas del alcance de esta versión. No representan tareas abiertas ni requisitos incompletos.

Este documento registra funcionalidades que fueron consideradas durante el análisis y deliberadamente excluidas del MVP. El comportamiento actual queda definido por `spec.md` y `decisiones.md`.

## Funciones excluidas del MVP

### P-001 — Autenticación y gestión de usuarios

- **Decisión:** el MVP no incluye inicio de sesión, roles ni gestión de sesiones.
- **Alcance vigente:** uso local o controlado, sin exposición pública ni tratamiento de datos reales de producción.
- **Motivo de exclusión:** autenticación, autorización, recuperación de contraseñas y gestión de sesiones conforman un alcance de seguridad separado.

### P-002 — Historial de movimientos de stock

- **Decisión:** el MVP conserva el stock actual y el historial comercial de presupuestos, pero no un libro de movimientos de stock.
- **Alcance vigente:** no se registra cada ingreso, egreso, ajuste, fecha y motivo como entidad independiente.

### P-003 — Importación y exportación de productos

- **Decisión:** el MVP no incorpora importación ni exportación CSV.
- **Alcance vigente:** la administración de productos se realiza desde la interfaz y la API implementadas.

### P-004 — Umbral de stock bajo configurable por producto

- **Decisión:** se utiliza un único umbral general fijo.
- **Alcance vigente:** un producto se considera con stock bajo cuando tiene cinco unidades o menos.

### P-005 — Administración independiente de categorías

- **Decisión:** las categorías son textos normalizados asociados a los productos, no una entidad administrable independiente.
- **Alcance vigente:** no existen pantallas ni endpoints separados para crear, editar o eliminar categorías.

## Cierre

Las cinco decisiones están tomadas y documentadas. Cualquier incorporación futura constituirá una ampliación de alcance independiente, que deberá especificarse y aprobarse como una nueva versión. No queda ninguna decisión por resolver para la entrega actual.

## Historial de cambios

- [cambio] 2026-10-22 — Se registran funciones consideradas y excluidas del alcance inicial.
- [cambio] 2026-11-15 — Se cierra el documento como catálogo de decisiones de alcance futuro; se elimina cualquier formulación que pudiera interpretarse como trabajo pendiente del MVP.
