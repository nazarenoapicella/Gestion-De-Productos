# Decisiones del proyecto

Este documento registra las decisiones concretas adoptadas para delimitar la propuesta inicial del MVP. Antes de programar, el dueño del proyecto debe revisar estos límites. Una decisión confirmada no debe cambiarse silenciosamente: si se modifica, hay que explicar el motivo, el impacto y actualizar `spec.md` cuando corresponda.

## D-001 — Alcance: catálogo e inventario básico

**Estado:** adoptada.

La primera versión administra productos y sus cantidades en stock. No administra ventas, compras, facturación, proveedores, pagos, sucursales ni pedidos.

**Motivo:** mantener el alcance pequeño y las reglas de negocio fáciles de verificar.

## D-002 — Usuario y entorno de uso

**Estado:** adoptada.

El MVP considera un único comercio y un único operador, sin inicio de sesión ni roles. Durante esta etapa se utilizará en local o en un entorno controlado. No debe exponerse a Internet ni utilizarse en producción con datos reales antes de incorporar y verificar autenticación, autorización y medidas de seguridad apropiadas.

**Motivo:** no sumar identidad y permisos al primer ciclo de aprendizaje, sin presentar la versión sin autenticación como segura para una publicación pública.

## D-003 — Tecnologías

**Estado:** adoptada.

- Frontend: HTML, CSS y JavaScript sin framework.
- Backend: Node.js y Express.
- Persistencia: SQLite.
- Comunicación: API REST que intercambia JSON.

El backend servirá la interfaz estática y la API bajo `/api` para mantener sencilla la ejecución local y evitar una configuración de CORS innecesaria en el MVP.

## D-004 — Datos de un producto

**Estado:** adoptada.

Cada producto tiene identificador generado automáticamente, nombre obligatorio, descripción opcional, categoría obligatoria, precio en pesos argentinos (ARS), cantidad actual de stock y marcas de tiempo de creación y última modificación.

## D-005 — Categorías como texto

**Estado:** adoptada.

La categoría se guarda como texto en el producto. No habrá una tabla ni una pantalla de administración de categorías en el MVP. La aplicación puede sugerir categorías que ya existan para evitar diferencias de escritura; el servidor quitará espacios sobrantes y la búsqueda por categoría ignorará mayúsculas y minúsculas.

**Motivo:** evitar el CRUD de categorías y las reglas adicionales que implicaría borrar o modificar una categoría utilizada por productos.

## D-006 — Precio y moneda

**Estado:** adoptada.

Los precios se expresan en pesos argentinos (ARS), admiten cero o un valor positivo y hasta dos decimales. El backend normaliza el valor para almacenarlo en centavos enteros y evitar errores de precisión de punto flotante en cálculos monetarios.

## D-007 — Edición de producto y ajuste de stock separados

**Estado:** adoptada.

Editar un producto permite cambiar nombre, descripción, categoría y precio, pero no la cantidad en stock. El stock inicial se establece al crear el producto y, luego, se actualiza mediante la acción específica de ajuste de stock.

**Motivo:** evitar que una edición común cambie el stock accidentalmente y mantener clara la intención de cada acción.

## D-008 — Reglas para ajustar stock

**Estado:** adoptada.

El usuario elige aumentar o disminuir el stock e introduce una cantidad entera positiva. No se acepta una cantidad igual a cero. Una disminución mayor que el stock disponible se rechaza completa y no modifica el producto.

## D-009 — Umbral fijo de stock bajo

**Estado:** adoptada.

Se considera stock bajo cuando la cantidad actual es menor o igual que 5. El umbral es común a todos los productos y no se puede configurar en el MVP. Un producto con stock cero también cuenta como stock bajo.

## D-010 — Indicadores del resumen

**Estado:** adoptada.

El resumen muestra tres indicadores diferentes:

1. **Productos registrados:** cantidad de registros de producto.
2. **Unidades en stock:** suma de las cantidades actuales de todos los productos.
3. **Productos con stock bajo:** cantidad de productos cuyo stock es menor o igual que 5.

No se calculará el valor monetario total del inventario en esta versión.

## D-011 — Eliminación de productos

**Estado:** adoptada.

Eliminar significa borrar el producto de la base de datos. La interfaz solicita confirmación antes de enviar la operación al backend. No se conserva historial de productos eliminados en el MVP.

## D-012 — Búsqueda, filtros y orden

**Estado:** adoptada.

La búsqueda por nombre es una coincidencia parcial que ignora mayúsculas y minúsculas. El filtro de categoría coincide con el nombre completo de la categoría, sin distinguir mayúsculas y minúsculas. Ambos filtros se pueden usar al mismo tiempo. Sin búsqueda ni categoría seleccionada, se muestran todos los productos.

La lista se ordena por nombre de producto en orden alfabético ascendente. No habrá paginación en el MVP.

## D-013 — Validación y errores

**Estado:** adoptada.

El backend valida todos los datos y es la autoridad final. La interfaz también valida para ayudar al usuario, pero no se confía en ella como mecanismo de seguridad. Los errores se comunican con mensajes comprensibles y no exponen detalles internos del servidor.

## D-014 — Sin historial de movimientos

**Estado:** adoptada para el MVP.

Se guarda el stock actual, pero no un historial de cada entrada o salida. El sistema no debe mostrar ni afirmar que dispone de una auditoría de movimientos.

**Motivo:** reducir tablas, pantallas y reglas en la primera versión. Esta limitación se puede reevaluar en una versión posterior.

## D-015 — Representación exacta del precio en la API

**Estado:** adoptada.

El campo `price` se envía y se devuelve en la API como texto decimal, por ejemplo `"1250.50"`, para conservar exactamente los centavos y evitar pérdidas al convertir JSON a números de punto flotante. Se aceptan valores no negativos con hasta dos cifras decimales, sin separadores de miles ni notación exponencial. El backend convierte el texto a `price_cents` entero y rechaza valores cuyo total en centavos supere `Number.MAX_SAFE_INTEGER`.

El límite de `Number.MAX_SAFE_INTEGER` es técnico y no representa un máximo comercial configurable.

**Motivo:** una cantidad monetaria recibida como número JSON puede perder precisión antes de que el backend la valide. El texto decimal conserva la representación enviada.

## D-016 — Contrato de lectura y errores de la API

**Estado:** adoptada.

Las respuestas de productos de la API usarán los campos `id`, `name`, `description`, `category`, `price`, `stock`, `createdAt` y `updatedAt`. `price` será texto decimal exacto con dos cifras, conforme a D-015; no se expondrá `price_cents` en el DTO. No se incluirá `lowStock` hasta que exista una decisión que lo requiera.

Los errores JSON usarán `{ "error": { "code": "...", "message": "...", "fields": {} } }`; `fields` se omite cuando no corresponda. Se utilizarán `VALIDATION_ERROR` para datos inválidos, `NOT_FOUND` para recursos inexistentes e `INTERNAL_SERVER_ERROR` para errores inesperados. Los errores internos devolverán un mensaje genérico y sus detalles técnicos no se expondrán en la respuesta.

**Motivo:** fijar un contrato coherente antes de conectar el frontend y evitar exponer detalles internos o representaciones de persistencia.

## D-017 — Implementación incremental de la interfaz

**Estado:** adoptada.

La pantalla principal y el listado se implementan antes que las operaciones de interfaz. No se muestran opciones de alta ni acciones por producto hasta que su flujo correspondiente esté implementado y pueda operarse. T-14 depende de T-13 e integrará el alta con la pantalla existente; las acciones de edición, eliminación y ajuste de stock se incorporarán con sus respectivas tareas.

**Motivo:** evitar controles sin comportamiento y mantener una secuencia comprobable sin adelantar funcionalidades de tareas posteriores.

## Historial de cambios

- [cambio] 2026-10-22 — Se documentan las decisiones iniciales necesarias para especificar el MVP sin ambigüedades relevantes.
- [cambio] 2026-10-28 — D-015 fija el precio decimal como texto en solicitudes y respuestas JSON para preservar centavos con precisión.
- [cambio] 2026-10-28 — D-016 adopta el DTO de producto sin `lowStock` y el formato/códigos comunes de error de la API.
- [cambio] 2026-10-28 — D-017 establece la implementación incremental de la interfaz y evita presentar acciones todavía no operativas.
