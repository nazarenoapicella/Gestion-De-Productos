# Especificación funcional — Stock Simple

**Estado:** especificación vigente del MVP.  
**Versión:** 1.1.  
**Última actualización:** 2026-11-02.

Este documento describe qué debe hacer la primera versión de Stock Simple. Debe servir como referencia común para quien solicita el sistema, quien lo analiza, quienes lo programan y los agentes de IA que colaboren. La implementación debe ajustarse a esta especificación; si se necesita otro comportamiento, primero debe revisarse y aprobarse el cambio documental.

## 1. Objetivo

Construir una aplicación web funcional para que una persona responsable de un comercio pequeño pueda mantener un catálogo de productos, consultar sus cantidades disponibles, actualizar el stock y detectar productos que necesitan reposición.

La aplicación debe conservar los datos en una base de datos persistente y permitir el uso de punta a punta desde una interfaz web.

## 2. Usuarios y contexto

- **Usuario previsto:** una persona encargada de administrar el inventario.
- **Comercio:** uno solo.
- **Acceso en el MVP:** sin inicio de sesión; uso local o en entorno controlado.
- **Limitación de seguridad:** no publicar la versión sin autenticación en Internet ni utilizarla para datos reales de producción. La publicación segura requiere una decisión y una implementación de seguridad por separado.

No hay roles, permisos diferentes ni administración de múltiples comercios en esta versión.

## 3. Alcance incluido

1. Listar productos registrados.
2. Crear un producto.
3. Consultar un producto por su identificador cuando sea necesario para editarlo.
4. Editar los datos descriptivos y comerciales de un producto.
5. Eliminar un producto después de una confirmación en la interfaz.
6. Buscar productos por coincidencia parcial de nombre.
7. Filtrar por categoría y combinar el filtro con la búsqueda.
8. Actualizar el stock disponible desde el formulario de edición del producto.
9. Mostrar un resumen con productos registrados, unidades en stock y productos con stock bajo.
10. Validar datos y mostrar errores comprensibles.

## 4. Fuera de alcance

La primera versión no incluirá:

- ventas, pedidos, carritos ni devoluciones;
- compras a proveedores ni recepción de mercadería;
- facturas, pagos, impuestos ni integración contable;
- usuarios, autenticación, recuperación de contraseñas o roles;
- más de un comercio o sucursales;
- administración independiente de categorías;
- historial o auditoría de movimientos de stock;
- importación o exportación CSV;
- códigos de barras, fotografías o archivos adjuntos;
- notificaciones automáticas;
- paginación, informes avanzados o valoración monetaria total del inventario.

No se deben agregar estas funciones por iniciativa propia como parte del MVP.

## 5. Modelo de datos del dominio

### 5.1 Producto

Cada producto deberá tener estos campos:

| Campo | Obligatorio | Regla |
|---|---|---|
| `id` | Sí | Identificador único generado por el sistema. No lo elige el usuario. |
| `name` | Sí | Texto recortado de espacios externos; debe quedar entre 1 y 100 caracteres. |
| `description` | No | Texto opcional de hasta 500 caracteres. Si está vacío, se guarda como vacío o nulo de manera consistente. |
| `category` | Sí | Texto recortado de espacios externos; debe quedar entre 1 y 50 caracteres. |
| `price` | Sí | Precio en ARS; en la API se transporta como texto decimal no negativo, con hasta dos cifras decimales. |
| `stock` | Sí | Número entero mayor o igual que cero. |
| `createdAt` | Sí | Fecha y hora de creación generadas por el sistema. |
| `updatedAt` | Sí | Fecha y hora de la última modificación relevante, generadas por el sistema. |

El backend debe guardar el precio en centavos enteros. La interfaz puede mostrarlo con el formato local de pesos argentinos, pero el valor almacenado no debe depender de operaciones de punto flotante sin normalización.

En las solicitudes y respuestas JSON de la API, `price` se representa como texto decimal, por ejemplo `"1250.50"`, para conservar exactamente los centavos. Se aceptan entradas decimales no negativas con hasta dos cifras decimales y sin separadores de miles ni notación exponencial. El backend las convierte a `price_cents`. Por el límite de representación segura de enteros en JavaScript, `price_cents` no puede superar `Number.MAX_SAFE_INTEGER`; este es un límite técnico, no comercial.

El nombre de un producto debe ser único después de normalizar mayúsculas, minúsculas, tildes y espacios repetidos. Se considera duplicado cualquier caso con la misma escritura equivalente, por ejemplo "Teclado Mecánico" y "teclado mecanico".

### 5.2 Categoría

La categoría es un campo de texto del producto, no una entidad separada. No existe un formulario independiente para crear, editar o eliminar categorías.

Al ingresar una categoría, se deben quitar los espacios al principio y al final. Una categoría puede estar asociada a muchos productos: no es un identificador único. Para evitar variantes visuales innecesarias, si ya existe una categoría equivalente se conserva su escritura canónica (ignorando mayúsculas, minúsculas, tildes y espacios repetidos). La interfaz puede sugerir categorías existentes y también permitir crear una nueva.

## 6. Reglas de negocio

### RN-01 — Nombre obligatorio

Un producto no puede crearse ni actualizarse con un nombre vacío después de quitar espacios externos. El nombre debe ser único cuando se normaliza para ignorar mayúsculas, minúsculas, tildes y espacios repetidos.

### RN-02 — Categoría obligatoria y reutilizable

Un producto debe tener una categoría no vacía después de quitar espacios externos. Una misma categoría puede utilizarse en muchos productos. Si el texto ingresado coincide con una categoría existente al ignorar mayúsculas, minúsculas, tildes y espacios repetidos, el sistema reutiliza la escritura ya registrada.

### RN-03 — Validación del precio

El precio debe recibirse como texto decimal no negativo, sin separadores de miles ni notación exponencial, con no más de dos cifras decimales. No se aceptan texto no numérico ni valores negativos. Un precio de cero está permitido. Después de convertirlo a centavos, el valor no puede superar `Number.MAX_SAFE_INTEGER`, para evitar pérdida de precisión técnica en el backend.

### RN-04 — Validación del stock

El stock inicial y el stock resultante de cualquier ajuste deben ser números enteros mayores o iguales que cero. No se aceptan decimales, valores negativos ni cantidades no numéricas.

### RN-05 — Edición del producto y su stock disponible

La edición actualiza nombre, descripción, categoría, precio y stock disponible en una única operación. El stock debe ser un entero seguro no negativo. La interfaz concentra la modificación de stock dentro del formulario de edición; no ofrece una acción independiente por fila. La API histórica de ajustes relativos se conserva por compatibilidad.

### RN-06 — Aumento del stock (compatibilidad de API)

El endpoint histórico permite seleccionar la operación de aumento e indicar una cantidad entera mayor que cero. El sistema suma esa cantidad al stock actual. La interfaz principal actualiza el valor absoluto desde el formulario de edición del producto.

### RN-07 — Disminución del stock (compatibilidad de API)

El endpoint histórico permite seleccionar la operación de disminución e indicar una cantidad entera mayor que cero. Si esa cantidad es mayor que el stock actual, el sistema rechaza la operación. La interfaz principal no expone esta operación en una acción separada: permite definir el stock disponible desde la edición, siempre como entero seguro no negativo.

### RN-08 — Umbral de stock bajo

Un producto tiene stock bajo cuando `stock <= 5`. El valor 5 es un umbral fijo en el MVP y no es configurable. Un producto con stock cero también se considera de stock bajo.

### RN-09 — Productos registrados

El indicador de productos registrados cuenta registros de productos, no unidades físicas.

### RN-10 — Unidades en stock

El indicador de unidades en stock es la suma de los valores `stock` de todos los productos registrados. Si no hay productos, el resultado es cero.

### RN-11 — Productos con stock bajo

El indicador de stock bajo cuenta los productos que cumplen `stock <= 5`; no suma unidades. Si no hay productos con stock bajo, el resultado es cero.

### RN-12 — Búsqueda por nombre

La búsqueda acepta texto parcial e ignora mayúsculas y minúsculas. Los espacios externos del término de búsqueda se ignoran. Si el campo está vacío, no limita el listado.

### RN-13 — Filtro por categoría

El filtro coincide con la categoría completa e ignora mayúsculas, minúsculas, tildes y espacios repetidos. Si no se selecciona categoría, no limita el listado.

### RN-14 — Combinación de filtros

Cuando hay búsqueda y categoría seleccionada, se muestran solo los productos que cumplen ambas condiciones.

### RN-15 — Orden del listado

Los productos se muestran por nombre en orden alfabético ascendente. No hay paginación en el MVP.

### RN-16 — Eliminación

La interfaz debe solicitar confirmación antes de eliminar. Si el usuario cancela, no se envía la petición de borrado. Si confirma, el backend elimina el producto. Si el identificador no existe, el backend devuelve una respuesta de no encontrado y no altera otros registros.

### RN-17 — Persistencia

Las operaciones exitosas deben guardarse en SQLite. Los datos no deben depender únicamente de variables en memoria ni desaparecer al reiniciar el servidor.

### RN-18 — Validación autoritativa en el backend

Todo dato recibido debe validarse en el servidor, aunque ya haya sido validado en el navegador. Una petición inválida no debe modificar parcialmente los datos.

### RN-19 — Crear presupuestos con reserva de stock

El usuario puede crear un presupuesto seleccionando entre los productos con stock disponible e indicando una cantidad entera positiva para cada uno. El backend vuelve a validar los identificadores, cantidades, existencia y disponibilidad en el momento de confirmar. El presupuesto conserva el nombre del producto, el precio unitario, la cantidad, el subtotal y el total como fotografía histórica. El precio se toma del producto en el momento de la emisión, no del navegador.

La creación del presupuesto, sus líneas y el descuento del stock se ejecutan en una única transacción. Si una línea no es válida, un producto no existe, el stock es insuficiente o el importe supera el rango admitido, se cancela toda la operación y no se reserva ninguna unidad.

### RN-20 — PDF de presupuesto

Al generar un presupuesto, el sistema debe producir un PDF descargable que identifique el número y la fecha del presupuesto, liste los productos, cantidades, precios unitarios y subtotales, y muestre el total general en pesos argentinos. El PDF se puede volver a descargar desde los listados.

### RN-21 — Resolución de presupuestos

Un presupuesto nuevo queda en estado `pending`. Solo se puede resolver una vez como `paid` o `rejected`. Al marcarlo pagado, deja la lista de pendientes y el stock no se devuelve porque ya fue reservado al crear el presupuesto. Al rechazarlo, el stock reservado se devuelve exactamente una vez y el presupuesto pasa al historial. Los presupuestos resueltos no se eliminan del historial.

### RN-22 — Protección de productos reservados

Un producto asociado a un presupuesto pendiente no se puede eliminar, para garantizar que el sistema pueda devolver sus unidades en caso de rechazo. La edición comercial posterior no modifica los datos históricos del presupuesto.

## 7. Historias de usuario y criterios de aceptación

### HU-01 — Consultar inventario

**Como** encargado del comercio, **quiero** ver los productos registrados, **para** conocer la información y el stock disponible.

Criterios de aceptación:

- Al abrir el inventario, se muestran los productos existentes ordenados por nombre.
- Si no hay productos, aparece un estado vacío claro. La opción para registrar el primero se muestra cuando el formulario de alta esté implementado.
- Cada fila muestra, como mínimo, nombre, categoría, precio y stock. Solo se muestran acciones que estén implementadas y se puedan operar; no se usan controles decorativos para funciones pendientes.
- Un error del servidor se informa sin mostrar una pantalla rota ni datos ficticios como si fueran reales.

### HU-02 — Registrar producto

**Como** encargado, **quiero** registrar un producto, **para** incorporarlo al inventario.

Criterios de aceptación:

- El formulario solicita nombre, categoría, precio y stock inicial; la descripción es opcional.
- Un envío válido crea un registro y este aparece en el inventario.
- Un nombre o categoría vacío, un precio inválido o un stock inicial inválido no crean el producto.
- Los espacios externos de nombre y categoría se quitan antes de guardar.
- El identificador y las marcas de tiempo los genera el sistema.

### HU-03 — Editar producto

**Como** encargado, **quiero** modificar los datos de un producto, **para** mantener el catálogo actualizado.

Criterios de aceptación:

- El formulario muestra los valores actuales del producto.
- Se pueden cambiar nombre, descripción, categoría, precio y stock disponible desde el mismo formulario de edición. El stock debe ser un entero seguro no negativo.
- Una actualización inválida no reemplaza parcialmente los datos existentes.
- Si el producto no existe, se informa que no fue encontrado.
- El nombre es único con normalización de mayúsculas, minúsculas y tildes. Las categorías se pueden reutilizar entre productos; las variantes equivalentes conservan una misma escritura canónica.

### HU-04 — Eliminar producto

**Como** encargado, **quiero** eliminar un producto, **para** quitar registros que ya no necesito.

Criterios de aceptación:

- Antes de borrar, la interfaz pide confirmación e identifica el producto.
- Si se cancela, el registro permanece.
- Si se confirma, el registro se elimina y deja de aparecer en el listado y en los indicadores.
- Un error al eliminar se informa y no se finge que el borrado tuvo éxito.

### HU-05 — Buscar y filtrar

**Como** encargado, **quiero** buscar por nombre y filtrar por categoría, **para** encontrar productos rápidamente.

Criterios de aceptación:

- La búsqueda acepta coincidencias parciales sin distinguir mayúsculas y minúsculas.
- El filtro de categoría coincide con la categoría completa sin distinguir mayúsculas y minúsculas.
- Es posible combinar búsqueda y categoría.
- Si no hay coincidencias, se informa que no se encontraron productos.
- Borrar el texto de búsqueda y seleccionar “Todas las categorías” vuelve a mostrar todos los productos; no se requieren botones separados para buscar o limpiar.

### HU-06 — Actualizar el stock desde el formulario de edición

**Como** encargado, **quiero** modificar el stock disponible dentro del formulario de edición del producto, **para** mantener actualizada la cantidad de unidades sin utilizar una acción separada.

Criterios de aceptación:

- El formulario de edición muestra el stock disponible actual, igual que el formulario de creación.
- El stock se ingresa como un entero seguro mayor o igual que cero; se rechazan valores negativos, decimales, vacíos y no numéricos.
- Guardar la edición envía los datos comerciales y el stock en una única operación.
- Una edición inválida no modifica ningún campo ni el stock guardado.
- La tabla y los indicadores se actualizan después de una respuesta exitosa.

### HU-08 — Crear y descargar presupuestos

**Como** encargado, **quiero** seleccionar productos y cantidades, **para** emitir un presupuesto con el detalle y el precio total en PDF.

Criterios de aceptación:

- El formulario permite seleccionar productos mediante un `select` y escribir cantidades enteras positivas.
- Solo se permiten productos con stock disponible y la cantidad no puede superar el stock actual.
- Se muestra el precio unitario, subtotal por producto y total general antes de confirmar.
- Al generar, el servidor vuelve a validar y reserva el stock de manera atómica.
- Si falla cualquier línea, no se crea el presupuesto ni se descuenta parcialmente el stock.
- Se descarga un PDF con el número, la fecha, el detalle y el total.

### HU-09 — Resolver presupuestos

**Como** encargado, **quiero** marcar un presupuesto como pagado o rechazado, **para** reflejar el resultado de la operación y mantener el inventario correcto.

Criterios de aceptación:

- Los presupuestos pendientes se muestran en una lista propia.
- Al marcar uno como pagado, desaparece de pendientes, queda en el historial y el stock no cambia.
- Al rechazarlo, desaparece de pendientes, queda en el historial y se restaura el stock reservado.
- Un presupuesto resuelto no puede volver a resolverse ni devolver stock por segunda vez.
- Mientras existan reservas pendientes, el producto relacionado no se puede eliminar.
- Cada presupuesto conserva los nombres y precios que tenía cuando se generó, incluso si después se modifica el catálogo.

### HU-07 — Consultar resumen y reposición

**Como** encargado, **quiero** ver los indicadores del inventario, **para** conocer el estado general y detectar productos que necesitan reposición.

Criterios de aceptación:

- Se muestran los productos registrados, las unidades en stock y los productos con stock bajo.
- Se considera stock bajo una cantidad menor o igual que cinco.
- Los productos con stock cero también aparecen identificados como stock bajo.
- Los indicadores se actualizan después de crear, editar (incluido el stock), eliminar o reservar/devolver unidades mediante un presupuesto.
- Si el inventario está vacío, los tres indicadores muestran cero.

## 8. Casos límite y comportamiento esperado

| Situación | Resultado esperado |
|---|---|
| Se intenta guardar un nombre compuesto solo por espacios. | Rechazar la operación; no crear ni modificar datos. |
| Se ingresa una categoría vacía o solo con espacios. | Rechazar la operación. |
| Se ingresa un precio negativo, texto o más de dos decimales. | Rechazar la operación y explicar el campo inválido. |
| Se ingresa stock inicial negativo, decimal o no numérico. | Rechazar la operación. |
| Se crea un producto con stock cero. | Aceptarlo y contarlo como producto con stock bajo. |
| Se ajusta el stock con cantidad cero, negativa o decimal. | Rechazar la operación sin cambiar el stock. |
| Se intenta disminuir más unidades que el stock disponible. | Rechazar la operación completa; conservar el stock previo. |
| Se intenta editar o borrar un identificador inexistente. | Responder no encontrado; no alterar otros productos. |
| Se utiliza una búsqueda que no coincide con ningún producto. | Mostrar un estado sin resultados, no un error técnico. |
| No se han registrado productos. | Mostrar un estado vacío y los indicadores en cero. |
| Se edita el producto y se envía un stock entero válido. | Actualizar datos comerciales y stock dentro de la misma operación `PUT`. |
| Se cancela el cuadro de confirmación de borrado. | No realizar la eliminación. |
| El servidor o la base de datos no están disponibles. | Mostrar un error comprensible; no informar falsamente que la operación se guardó. |
| Una solicitud inválida llega directamente a la API, sin pasar por el formulario web. | El backend la rechaza; no depende de la validación del navegador. |
| Se intenta registrar un producto con un nombre ya existente, ignorando mayúsculas, minúsculas y tildes. | Rechazar el alta y conservar el inventario sin cambios. |
| Se intenta presupuestar una cantidad cero, negativa, decimal, texto o superior al stock. | Rechazar el presupuesto completo; no reservar ninguna unidad. |
| Uno de varios productos de un presupuesto tiene stock insuficiente. | Cancelar toda la transacción; el stock de ninguna línea se modifica. |
| Se genera un presupuesto válido. | Guardar precios y nombres históricos, descontar el stock y generar el PDF. |
| Se marca un presupuesto como pagado. | Sacarlo de pendientes, conservarlo en el historial y mantener descontado el stock. |
| Se marca un presupuesto como rechazado. | Devolver todo el stock reservado una sola vez y conservar el presupuesto en el historial. |
| Se intenta resolver por segunda vez un presupuesto. | Rechazar con conflicto y no modificar el stock. |
| Se intenta eliminar un producto con un presupuesto pendiente. | Rechazar la eliminación para preservar la capacidad de devolver el stock. |

## 9. API prevista

La implementación utilizará rutas JSON bajo `/api`. Los nombres exactos pueden ajustarse por consistencia técnica, pero no deben cambiar el comportamiento descrito en esta especificación.

| Método y ruta | Propósito |
|---|---|
| `GET /api/products` | Listar productos; admite `search` y `category` como filtros opcionales. |
| `GET /api/products/:id` | Consultar un producto por identificador. |
| `POST /api/products` | Crear un producto. |
| `PUT /api/products/:id` | Actualizar nombre, descripción, categoría, precio y stock. Exige nombre, categoría, precio y stock; descripción es opcional y se conserva si se omite. |
| `DELETE /api/products/:id` | Eliminar un producto. |
| `PATCH /api/products/:id/stock` | Aumentar o disminuir el stock mediante operación y cantidad. |
| `GET /api/summary` | Obtener los tres indicadores del inventario. |
| `POST /api/budgets` | Crear un presupuesto y reservar el stock. |
| `GET /api/budgets` | Listar presupuestos pendientes e históricos. |
| `GET /api/budgets/:id` | Consultar un presupuesto y sus líneas. |
| `GET /api/budgets/:id/pdf` | Descargar el PDF del presupuesto. |
| `PATCH /api/budgets/:id/status` | Marcar el presupuesto como `paid` o `rejected`. |

Las solicitudes y respuestas intercambian JSON, salvo que una respuesta no tenga cuerpo. Los errores deben utilizar códigos HTTP apropiados: `400` para datos inválidos, `404` para un producto inexistente y `500` para un error inesperado del servidor. Los errores JSON usan `{ "error": { "code": "...", "message": "...", "fields": {} } }`; `fields` se omite cuando no corresponda. Los códigos son `VALIDATION_ERROR`, `NOT_FOUND` e `INTERNAL_SERVER_ERROR`, respectivamente. Los errores internos no deben exponer detalles técnicos en la respuesta. El DTO de producto usa `id`, `name`, `description`, `category`, `price`, `stock`, `createdAt` y `updatedAt`; `price` es texto decimal exacto conforme a D-015 y no se devuelve `price_cents`. No se incluye `lowStock` sin una decisión que lo adopte. Ver D-016.

## 10. Requisitos no funcionales

- **Usabilidad:** formularios claros, etiquetas visibles, errores próximos al campo que corresponda y confirmación de operaciones destructivas.
- **Accesibilidad básica:** HTML semántico, controles utilizables con teclado, etiquetas asociadas a sus campos y contraste legible.
- **Consistencia:** ninguna operación inválida debe dejar los datos parcialmente actualizados.
- **Persistencia:** usar SQLite y comprobar que los datos sobreviven al reinicio del servidor.
- **Seguridad:** consultas parametrizadas, validación en servidor, manejo seguro del texto de usuario y ausencia de secretos en Git.
- **Mantenibilidad:** código JavaScript legible, responsabilidades claras y dependencias limitadas.
- **Errores:** mensajes entendibles para el usuario y detalles técnicos solo en registros de desarrollo apropiados.
- **Idioma:** interfaz y mensajes en español.

## 11. Criterios globales para considerar terminado el MVP

El MVP se considera terminado cuando:

1. Las siete historias de usuario de esta especificación pasan sus criterios de aceptación.
2. Las reglas RN-01 a RN-18 se cumplen en la API, no solo en el navegador.
3. Los datos persisten tras reiniciar el servidor.
4. Se comprueban al menos los casos límite de la sección 8, mediante pruebas automatizadas de backend o comprobaciones manuales documentadas cuando corresponda.
5. El frontend informa correctamente de los estados de carga, éxito, vacío y error necesarios.
6. El README contiene instrucciones reales y verificadas de instalación, ejecución y pruebas.
7. No hay funcionalidades adicionales fuera de alcance que introduzcan reglas no aprobadas.

## 12. Documentos relacionados

- `ideas.md`: contexto y necesidad original.
- `decisiones.md`: decisiones funcionales y técnicas adoptadas.
- `preguntas-abiertas.md`: asuntos para evaluar en una versión futura.
- `glosario.md`: terminología del dominio.
- `../agents.md`: instrucciones generales para agentes.
- `../rules/`: reglas por rol.

## Historial de cambios

- [cambio] 2026-10-22 — Se redacta la primera especificación del MVP a partir de la idea y de las decisiones iniciales.
- [cambio] 2026-10-28 — RN-03 y el contrato de producto precisan el transporte de `price` como texto decimal exacto, conforme a D-015.
- [cambio] 2026-11-02 — Se incorporan reglas, historias, casos límite y endpoints para presupuestos, PDF, reservas de stock y resolución de operaciones.
- [cambio] 2026-11-02 — La búsqueda del inventario filtra al escribir y el stock se edita dentro del formulario del producto; se elimina la acción independiente de ajuste.
