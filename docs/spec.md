# Especificación funcional — Stock Simple

**Estado:** contrato inicial del MVP; revisar antes de comenzar la implementación.  
**Versión:** 1.0.  
**Última actualización:** 2026-10-22.

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
8. Aumentar o disminuir el stock mediante una acción específica.
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

El nombre de un producto no necesita ser único en el MVP. Dos registros con el mismo nombre son válidos si tienen identificadores distintos.

### 5.2 Categoría

La categoría es un campo de texto del producto, no una entidad separada. No existe un formulario independiente para crear, editar o eliminar categorías.

Al ingresar una categoría, se deben quitar los espacios al principio y al final. Para filtrar, las comparaciones ignoran mayúsculas y minúsculas. La interfaz puede sugerir categorías ya utilizadas, pero esa sugerencia no debe introducir una regla adicional que impida registrar texto válido.

## 6. Reglas de negocio

### RN-01 — Nombre obligatorio

Un producto no puede crearse ni actualizarse con un nombre vacío después de quitar espacios externos. Se permiten nombres repetidos.

### RN-02 — Categoría obligatoria

Un producto debe tener una categoría no vacía después de quitar espacios externos.

### RN-03 — Validación del precio

El precio debe recibirse como texto decimal no negativo, sin separadores de miles ni notación exponencial, con no más de dos cifras decimales. No se aceptan texto no numérico ni valores negativos. Un precio de cero está permitido. Después de convertirlo a centavos, el valor no puede superar `Number.MAX_SAFE_INTEGER`, para evitar pérdida de precisión técnica en el backend.

### RN-04 — Validación del stock

El stock inicial y el stock resultante de cualquier ajuste deben ser números enteros mayores o iguales que cero. No se aceptan decimales, valores negativos ni cantidades no numéricas.

### RN-05 — Edición separada del stock

La operación de editar un producto actualiza nombre, descripción, categoría y precio. No puede cambiar el stock, aunque el cliente incluya accidentalmente un campo `stock` en la solicitud de edición. Los cambios de stock se realizan mediante la operación específica de ajuste.

### RN-06 — Aumento del stock

El usuario selecciona la opción de aumentar e indica una cantidad entera mayor que cero. El sistema suma esa cantidad al stock actual y guarda el resultado si la operación es válida.

### RN-07 — Disminución del stock

El usuario selecciona la opción de disminuir e indica una cantidad entera mayor que cero. Si esa cantidad es mayor que el stock actual, el sistema rechaza la operación y mantiene el stock sin cambios. El stock nunca puede quedar negativo.

### RN-08 — Umbral de stock bajo

Un producto tiene stock bajo cuando `stock <= 5`. El valor 5 es un umbral fijo en el MVP y no es configurable. Un producto con stock cero también se considera de stock bajo.

### RN-09 — Productos registrados

El indicador de productos registrados cuenta registros de productos, no unidades físicas. Dos productos con el mismo nombre cuentan como dos registros.

### RN-10 — Unidades en stock

El indicador de unidades en stock es la suma de los valores `stock` de todos los productos registrados. Si no hay productos, el resultado es cero.

### RN-11 — Productos con stock bajo

El indicador de stock bajo cuenta los productos que cumplen `stock <= 5`; no suma unidades. Si no hay productos con stock bajo, el resultado es cero.

### RN-12 — Búsqueda por nombre

La búsqueda acepta texto parcial e ignora mayúsculas y minúsculas. Los espacios externos del término de búsqueda se ignoran. Si el campo está vacío, no limita el listado.

### RN-13 — Filtro por categoría

El filtro coincide con la categoría completa e ignora mayúsculas y minúsculas. Si no se selecciona categoría, no limita el listado.

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

## 7. Historias de usuario y criterios de aceptación

### HU-01 — Consultar inventario

**Como** encargado del comercio, **quiero** ver los productos registrados, **para** conocer la información y el stock disponible.

Criterios de aceptación:

- Al abrir el inventario, se muestran los productos existentes ordenados por nombre.
- Si no hay productos, aparece un estado vacío claro y una opción para registrar el primero.
- Cada fila muestra, como mínimo, nombre, categoría, precio, stock y las acciones disponibles.
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
- Se pueden cambiar nombre, descripción, categoría y precio.
- El stock no se modifica desde el formulario de edición.
- Una actualización inválida no reemplaza parcialmente los datos existentes.
- Si el producto no existe, se informa que no fue encontrado.

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
- Limpiar los filtros vuelve a mostrar todos los productos.

### HU-06 — Ajustar el stock

**Como** encargado, **quiero** aumentar o disminuir las unidades de un producto, **para** mantener actualizada la cantidad disponible.

Criterios de aceptación:

- La acción exige elegir aumento o disminución e ingresar una cantidad entera positiva.
- Un aumento válido incrementa el stock por la cantidad indicada.
- Una disminución válida resta la cantidad indicada.
- Si se intenta disminuir más de lo disponible, la operación se rechaza y el stock permanece igual.
- El sistema no permite stock negativo ni cambios con cantidad cero o decimal.
- El nuevo stock aparece en la interfaz después de una respuesta exitosa.

### HU-07 — Consultar resumen y reposición

**Como** encargado, **quiero** ver los indicadores del inventario, **para** conocer el estado general y detectar productos que necesitan reposición.

Criterios de aceptación:

- Se muestran los productos registrados, las unidades en stock y los productos con stock bajo.
- Se considera stock bajo una cantidad menor o igual que cinco.
- Los productos con stock cero también aparecen identificados como stock bajo.
- Los indicadores se actualizan después de crear, editar, eliminar o ajustar el stock.
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
| Se envía un campo `stock` dentro de la edición normal. | Ignorar ese campo en la operación de edición; el stock solo cambia mediante el ajuste. |
| Se cancela el cuadro de confirmación de borrado. | No realizar la eliminación. |
| El servidor o la base de datos no están disponibles. | Mostrar un error comprensible; no informar falsamente que la operación se guardó. |
| Una solicitud inválida llega directamente a la API, sin pasar por el formulario web. | El backend la rechaza; no depende de la validación del navegador. |
| Se registran dos productos con el mismo nombre. | Permitir ambos; cada uno mantiene su identificador y stock independiente. |

## 9. API prevista

La implementación utilizará rutas JSON bajo `/api`. Los nombres exactos pueden ajustarse por consistencia técnica, pero no deben cambiar el comportamiento descrito en esta especificación.

| Método y ruta | Propósito |
|---|---|
| `GET /api/products` | Listar productos; admite `search` y `category` como filtros opcionales. |
| `GET /api/products/:id` | Consultar un producto por identificador. |
| `POST /api/products` | Crear un producto. |
| `PUT /api/products/:id` | Actualizar nombre, descripción, categoría y precio, no el stock. |
| `DELETE /api/products/:id` | Eliminar un producto. |
| `PATCH /api/products/:id/stock` | Aumentar o disminuir el stock mediante operación y cantidad. |
| `GET /api/summary` | Obtener los tres indicadores del inventario. |

Las solicitudes y respuestas intercambian JSON, salvo que una respuesta no tenga cuerpo. Los errores deben utilizar códigos HTTP apropiados: por ejemplo, `400` para datos inválidos, `404` para un producto inexistente y `500` para un error inesperado del servidor. El formato detallado del objeto de error debe documentarse al implementar la API y mantenerse consistente.

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
