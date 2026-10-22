# Preguntas abiertas

Este archivo separa los asuntos no resueltos del alcance que ya puede desarrollarse. Las preguntas de esta lista **no bloquean la implementación del MVP** porque tienen una decisión temporal documentada o pertenecen a versiones futuras. No deben incorporarse al sistema sin una decisión explícita.

## Pendientes para evaluar en versiones futuras

### P-001 — ¿Se necesita inicio de sesión?

- **Estado:** fuera del MVP; pendiente para una versión que necesite uso remoto o varios operadores.
- **Impacto:** autenticación, gestión de sesiones, recuperación de contraseñas, seguridad y posibles roles.
- **Resolución provisional:** el MVP se limita al uso local o controlado. No se puede publicar abiertamente ni usar en producción con datos reales sin resolver este punto.

### P-002 — ¿Conviene conservar un historial de movimientos de stock?

- **Estado:** fuera del MVP.
- **Alternativa a evaluar:** registrar fecha, producto, tipo de movimiento, cantidad y motivo. Esto permitiría explicar cómo se llegó al stock actual, pero agrega datos, pantallas y reglas de consistencia.

### P-003 — ¿Hace falta importar o exportar productos?

- **Estado:** fuera del MVP.
- **Alternativa a evaluar:** exportación CSV para respaldo o análisis y, más adelante, importación validada. La importación requiere definir cómo resolver filas inválidas y productos duplicados.

### P-004 — ¿El umbral de stock bajo debe configurarse por producto?

- **Estado:** fuera del MVP.
- **Resolución provisional:** el umbral general y fijo es de cinco unidades o menos para todos los productos.

### P-005 — ¿Las categorías deberían ser entidades administrables?

- **Estado:** fuera del MVP.
- **Resolución provisional:** la categoría es texto en el producto. No existe alta, edición o eliminación independiente de categorías.

## Criterio para cerrar una pregunta

Cuando se decida incorporar una de estas funciones, registrar la decisión en `decisiones.md`, actualizar `spec.md`, revisar el alcance y añadir los criterios de aceptación correspondientes. Si una pregunta resulta necesaria para entender un requisito actual, entonces sí debe resolverse antes de implementar ese requisito.

## Historial de cambios

- [cambio] 2026-10-22 — Se registran cuestiones para versiones futuras sin dejar bloqueado el alcance inicial.
