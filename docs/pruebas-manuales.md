# Registro de pruebas manuales — Stock Simple

> **Estado:** COMPLETADO según confirmación del responsable del proyecto.
> **Nota:** el equipo confirma que los escenarios se ejecutaron durante el desarrollo y la validación final. Este registro consolida el estado documental que no se había actualizado; no se inventan fechas, capturas ni métricas ausentes.

## Inventario y productos

- [x] Alta de producto con datos válidos y persistencia.
- [x] Rechazo de nombre/categoría vacíos y límites excedidos.
- [x] Rechazo de precio negativo, mal formado o con más de dos decimales.
- [x] Aceptación de precio cero y stock cero.
- [x] Edición conjunta de datos comerciales y stock; rechazo de actualizaciones inválidas sin cambios parciales.
- [x] Eliminación con confirmación y actualización de indicadores.
- [x] Protección frente a eliminación de productos reservados por presupuestos emitidos.

## Búsqueda, filtros y resumen

- [x] Búsqueda parcial por nombre, insensible a mayúsculas/minúsculas.
- [x] Filtro por categoría normalizada.
- [x] Combinación de búsqueda y categoría.
- [x] Estado vacío cuando no hay coincidencias.
- [x] Orden alfabético estable.
- [x] Actualización de productos registrados, unidades y stock bajo tras operaciones.

## Stock y presupuestos

- [x] Aumento y disminución por API, incluyendo rechazo de stock insuficiente.
- [x] Creación de presupuesto con múltiples productos y cantidades.
- [x] Reserva de stock y persistencia atómica.
- [x] Reversión completa cuando una línea del presupuesto no puede reservarse.
- [x] Generación y descarga de PDF desde datos históricos persistidos.
- [x] Resolución como pagado sin devolver stock.
- [x] Resolución como rechazado con devolución de stock exactamente una vez.
- [x] Conservación del presupuesto resuelto en historial.
- [x] Protección de nombre y precio históricos frente a ediciones posteriores del catálogo.

## Cierre

El equipo confirma que todos los recorridos manuales de aceptación fueron ejecutados y aprobados. El estado de aceptación es COMPLETADO. Las verificaciones técnicas adicionales realizadas durante la auditoría se encuentran en `INFORME-VERIFICACION.md` y no dejan acciones abiertas para el proyecto.
