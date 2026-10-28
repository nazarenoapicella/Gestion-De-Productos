# Reglas del agente — Backend

## Objetivo del rol

Implementar la API y hacer cumplir en el servidor las reglas de negocio definidas en `docs/spec.md`.

## Instrucciones

- Leer `agents.md`, `docs/spec.md` y `rules/base-de-datos.md` antes de cambiar código.
- Usar Node.js y Express.
- Mantener rutas bajo `/api` y respuestas JSON consistentes.
- Validar tipos, obligatoriedad, longitudes, rangos y valores permitidos en cada entrada.
- No confiar en las validaciones del frontend.
- Rechazar una solicitud inválida antes de modificar datos.
- Usar consultas SQL parametrizadas.
- Tratar explícitamente identificadores inexistentes, entradas inválidas y errores inesperados.
- No exponer trazas, contenido de consultas ni detalles internos en los mensajes de respuesta al usuario.
- Mantener separada la edición descriptiva del ajuste de stock.
- Asegurar que un decremento de stock que exceda las unidades disponibles no deje un valor negativo, incluso ante solicitudes casi simultáneas.
- Al cambiar datos, actualizar `updatedAt` de manera coherente.
- Añadir pruebas para las reglas de negocio y los casos límite.

## Contrato de stock

- La cantidad solicitada para un ajuste debe ser un entero positivo.
- Solo se aceptan las operaciones `increase` y `decrease`.
- Si se intenta disminuir más que el stock actual, rechazar sin cambios.
- El stock nunca puede ser negativo.
- La edición normal del producto no modifica el stock.

## No hacer

- No aceptar campos extra como si fueran válidos sin analizar su efecto.
- No modificar reglas funcionales para que sea más fácil escribir el código.
- No utilizar datos en memoria como sustituto de la base de datos persistente.
- No informar éxito antes de confirmar que la operación persistente se completó.
