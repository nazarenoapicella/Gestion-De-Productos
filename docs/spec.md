# Especificación funcional — Stock Simple

**Estado:** especificación vigente del MVP.
**Versión:** 1.2.
**Última actualización:** 2026-11-16.

Este documento describe qué debe hacer la primera versión de Stock Simple. Debe servir como referencia común para quien solicita el sistema, quien lo analiza, quienes lo programan y los agentes de IA que colaboren. La implementación debe ajustarse a esta especificación; si se necesita otro comportamiento, primero debe revisarse y aprobarse el cambio documental.

## 1. Objetivo

Construir una aplicación web funcional para que una persona responsable de un comercio pequeño pueda mantener un catálogo de productos, consultar sus cantidades disponibles, actualizar el stock y detectar productos que necesitan reposición.

La aplicación debe conservar los datos en una base de datos persistente y permitir el uso de punta a punta desde una interfaz web.

## 2. Usuarios y contexto

- **Usuario previsto:** una persona encargada de administrar el inventario.
- **Comercio:** uno solo.
- **Acceso en el MVP:** sin inicio de sesión; uso local o en entorno controlado. Se admite una demo pública únicamente para evaluación académica.
- **Limitación de seguridad:** la demo pública no es una publicación segura de producción. Debe contener solo datos ficticios/de prueba; no se deben ingresar datos personales ni comerciales reales. No hay autenticación, autorización ni separación de datos por usuario.

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
11. Crear presupuestos con entre 1 y 50 productos distintos, capturar sus precios y nombres históricos, reservar stock y generar un PDF.
12. Resolver presupuestos emitidos como pagados o rechazados, mantener un historial y devolver el stock reservado una sola vez cuando se rechazan.

## 4. Fuera de alcance

La primera versión no incluirá:

- ventas y pedidos reales, carritos, cobros electrónicos ni devoluciones comerciales. El estado `paid` de un presupuesto es una registración manual, no un procesamiento de pago;
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
| `stock` | Sí | Entero seguro de JavaScript entre 0 y `Number.MAX_SAFE_INTEGER`, inclusive. |
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

Un producto debe tener un nombre de entre 1 y 100 caracteres Unicode después de quitar espacios externos. No puede crearse ni actualizarse con un nombre vacío. El nombre debe ser único cuando se normaliza para ignorar mayúsculas, minúsculas, tildes y espacios repetidos.

### RN-02 — Categoría obligatoria y reutilizable

Un producto debe tener una categoría de entre 1 y 50 caracteres Unicode después de quitar espacios externos. Una misma categoría puede utilizarse en muchos productos. Si el texto ingresado coincide con una categoría existente al ignorar mayúsculas, minúsculas, tildes y espacios repetidos, el sistema reutiliza la escritura ya registrada.

### RN-03 — Validación del precio

El precio debe recibirse como texto decimal no negativo, sin separadores de miles ni notación exponencial, con no más de dos cifras decimales. No se aceptan texto no numérico ni valores negativos. Un precio de cero está permitido. Después de convertirlo a centavos, el valor no puede superar `Number.MAX_SAFE_INTEGER`, para evitar pérdida de precisión técnica en el backend.

### RN-04 — Validación del stock

El stock inicial y el stock resultante de cualquier actualización deben ser enteros seguros de JavaScript, mayores o iguales que cero y menores o iguales que `Number.MAX_SAFE_INTEGER`. No se aceptan decimales, valores negativos, cantidades no numéricas ni valores fuera del rango entero seguro. Este es un límite técnico para conservar la precisión, no un máximo comercial.

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

Los productos se muestran por nombre en orden alfabético ascendente (`name COLLATE NOCASE ASC`). Cuando dos nombres empatan en ese orden, se utiliza `id ASC` como criterio secundario para que el resultado sea determinista. No hay paginación en el MVP.

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

Un presupuesto nuevo queda en estado `issued` (emitido). Los únicos estados admitidos son `issued`, `paid` y `rejected`; no existe un estado `pending`. Solo se puede resolver una vez como `paid` o `rejected`. Al marcarlo pagado, deja la lista de emitidos y el stock no se devuelve porque ya fue reservado al crear el presupuesto. Al rechazarlo, el stock reservado se devuelve exactamente una vez y el presupuesto pasa al historial. Los presupuestos resueltos no se eliminan del historial. Las bases SQLite creadas por versiones anteriores convierten automáticamente el valor histórico `pending` a `issued`, sin perder presupuestos ni líneas.

### RN-22 — Protección de productos reservados

Un producto asociado a un presupuesto emitido no se puede eliminar, para garantizar que el sistema pueda devolver sus unidades en caso de rechazo. La edición comercial posterior no modifica los datos históricos del presupuesto.

## 7. Historias de usuario y criterios de aceptación

Los criterios se identifican como `CA-HU.N` y siguen el formato **Dado / Cuando / Entonces**. Cada historia indica las reglas de negocio que cubre. Los ejemplos son verificables mediante la interfaz, la API o las pruebas automatizadas, según corresponda.

### HU-01 — Consultar inventario

**Como** encargado del comercio, **quiero** ver los productos registrados, **para** conocer la información y el stock disponible.

**Reglas relacionadas:** RN-09, RN-10, RN-11, RN-15, RN-17 y RN-18.

| ID | Criterio de aceptación |
|---|---|
| CA-01.1 | **Dado** que existen productos con distintos nombres, categorías, precios y cantidades, **cuando** abro el inventario, **entonces** se muestran ordenados alfabéticamente por nombre y cada fila presenta nombre, categoría, precio y stock. |
| CA-01.2 | **Dado** que no hay productos registrados, **cuando** abro el inventario, **entonces** aparece un estado vacío claro y no se muestran filas ficticias. |
| CA-01.3 | **Dado** que el servidor responde con un error, **cuando** intento consultar el inventario, **entonces** la interfaz informa el problema y no presenta una lista vacía como si fuera el resultado real. |

### HU-02 — Registrar producto

**Como** encargado, **quiero** registrar un producto, **para** incorporarlo al inventario.

**Reglas relacionadas:** RN-01, RN-02, RN-03, RN-04, RN-17 y RN-18.

| ID | Criterio de aceptación |
|---|---|
| CA-02.1 | **Dado** que completo nombre, categoría, precio y stock con datos válidos, **cuando** envío el formulario de alta, **entonces** se crea el producto y el servidor genera su identificador y sus marcas de tiempo. |
| CA-02.2 | **Dado** que ingreso espacios externos en nombre y categoría, **cuando** guardo el producto, **entonces** se quitan esos espacios antes de persistir los valores. |
| CA-02.3 | **Dado** que ya existe una categoría equivalente por mayúsculas, tildes o espacios repetidos, **cuando** registro un producto usando otra variante, **entonces** se reutiliza la escritura canónica existente. |
| CA-02.4 | **Dado** que el nombre está vacío, supera 100 caracteres o ya existe otro nombre equivalente, **cuando** envío el alta, **entonces** el backend rechaza la operación y no crea un registro. |
| CA-02.5 | **Dado** que el precio es negativo, no numérico, contiene más de dos decimales, separadores de miles o notación exponencial, **cuando** envío el alta, **entonces** el backend lo rechaza y no crea el producto. Un precio igual a cero sí se acepta. |
| CA-02.6 | **Dado** que el stock inicial es negativo, decimal, no numérico o no puede representarse como entero seguro, **cuando** envío el alta, **entonces** el backend rechaza la operación y no crea el producto. |
| CA-02.7 | **Dado** que omito la descripción o la envío vacía, **cuando** registro un producto válido, **entonces** la descripción queda ausente o vacía de forma consistente, según el contrato de persistencia. |

### HU-03 — Editar producto

**Como** encargado, **quiero** modificar los datos de un producto, **para** mantener el catálogo actualizado.

**Reglas relacionadas:** RN-01, RN-02, RN-03, RN-04, RN-05, RN-17, RN-18 y RN-22.

| ID | Criterio de aceptación |
|---|---|
| CA-03.1 | **Dado** un producto existente, **cuando** actualizo nombre, descripción, categoría, precio y stock con valores válidos, **entonces** el servidor guarda todos los cambios en una única operación y devuelve el producto actualizado. |
| CA-03.2 | **Dado** un producto existente, **cuando** envío un cambio con nombre duplicado normalizado o con cualquier otro campo inválido, **entonces** se rechaza la edición completa y permanecen intactos todos los valores anteriores. |
| CA-03.3 | **Dado** un producto incluido en un presupuesto emitido, **cuando** modifico su nombre o precio en el catálogo, **entonces** el presupuesto conserva el nombre y precio capturados al momento de su emisión. |
| CA-03.4 | **Dado** un identificador que no corresponde a ningún producto, **cuando** intento editarlo, **entonces** la API responde que el producto no existe y no modifica otros registros. |

### HU-04 — Eliminar producto

**Como** encargado, **quiero** eliminar un producto, **para** quitar registros que ya no necesito.

**Reglas relacionadas:** RN-16, RN-17, RN-18 y RN-22.

| ID | Criterio de aceptación |
|---|---|
| CA-04.1 | **Dado** un producto visible en el inventario, **cuando** inicio su eliminación, **entonces** la interfaz solicita confirmación e identifica el producto. |
| CA-04.2 | **Dado** que está abierta la confirmación de eliminación, **cuando** cancelo, **entonces** no se envía la petición `DELETE` y el producto permanece en el inventario. |
| CA-04.3 | **Dado** un producto que no tiene una reserva activa y confirmo su eliminación, **cuando** el backend procesa el pedido, **entonces** elimina únicamente ese producto y la interfaz actualiza el listado y los indicadores. |
| CA-04.4 | **Dado** un producto asociado a un presupuesto emitido, **cuando** intento eliminarlo, **entonces** el backend rechaza la operación para preservar la posibilidad de devolver el stock reservado. |
| CA-04.5 | **Dado** un identificador inexistente, **cuando** solicito eliminarlo, **entonces** la API responde `404` y no modifica ningún otro producto. |

### HU-05 — Buscar y filtrar

**Como** encargado, **quiero** buscar por nombre y filtrar por categoría, **para** encontrar productos rápidamente.

**Reglas relacionadas:** RN-12, RN-13, RN-14 y RN-15.

| ID | Criterio de aceptación |
|---|---|
| CA-05.1 | **Dado** que existen productos con nombres que contienen el término buscado, **cuando** escribo una parte del nombre en el campo de búsqueda, **entonces** aparecen las coincidencias parciales sin distinguir mayúsculas y minúsculas. |
| CA-05.2 | **Dado** que existen productos con categorías normalizadas, **cuando** selecciono una categoría, **entonces** aparecen solo los productos de esa categoría, ignorando mayúsculas, tildes y espacios repetidos. |
| CA-05.3 | **Dado** que hay un término de búsqueda y una categoría seleccionada, **cuando** aplico ambos filtros, **entonces** aparecen únicamente los productos que cumplen las dos condiciones. |
| CA-05.4 | **Dado** que hay filtros activos, **cuando** borro el texto de búsqueda y elijo “Todas las categorías”, **entonces** vuelve a mostrarse el inventario completo. |
| CA-05.5 | **Dado** que ningún producto coincide con los filtros, **cuando** consulto el resultado, **entonces** se muestra un estado sin resultados y no un error técnico. |

### HU-06 — Actualizar el stock desde el formulario de edición

**Como** encargado, **quiero** modificar el stock disponible dentro del formulario de edición del producto, **para** mantener actualizada la cantidad de unidades sin utilizar una acción separada.

**Reglas relacionadas:** RN-04, RN-05, RN-06, RN-07 y RN-18.

| ID | Criterio de aceptación |
|---|---|
| CA-06.1 | **Dado** un producto existente, **cuando** abro su formulario de edición, **entonces** el campo de stock muestra la cantidad disponible actual. |
| CA-06.2 | **Dado** un stock nuevo que es un entero seguro mayor o igual a cero, **cuando** guardo la edición, **entonces** el valor se actualiza junto con los datos comerciales mediante una única petición. |
| CA-06.3 | **Dado** que ingreso un stock negativo, decimal, vacío, no numérico o superior a `Number.MAX_SAFE_INTEGER`, **cuando** intento guardar, **entonces** el backend rechaza la operación y no cambia ni los datos comerciales ni el stock anterior. |
| CA-06.4 | **Dado** que el backend confirma una edición de stock, **cuando** la interfaz recibe la respuesta exitosa, **entonces** actualiza el valor en la tabla y los indicadores del inventario. |
| CA-06.5 | **Dado** un producto con stock 8, **cuando** la API histórica recibe un aumento de 3 unidades, **entonces** el stock resultante es 11. |
| CA-06.6 | **Dado** un producto con stock 11, **cuando** la API histórica recibe una disminución de 4 unidades, **entonces** el stock resultante es 7; si solicita disminuir 8, la operación se rechaza y el stock permanece en 7. |
| CA-06.7 | **Dado** un ajuste con cantidad cero, negativa, decimal, no segura o una operación desconocida, **cuando** llega al endpoint histórico, **entonces** la API lo rechaza sin modificar el stock. |

### HU-07 — Consultar resumen y reposición

**Como** encargado, **quiero** ver los indicadores del inventario, **para** conocer el estado general y detectar productos que necesitan reposición.

**Reglas relacionadas:** RN-08, RN-09, RN-10, RN-11 y RN-17.

| ID | Criterio de aceptación |
|---|---|
| CA-07.1 | **Dado** un inventario con tres productos, **cuando** consulto el resumen, **entonces** el indicador de productos registrados cuenta tres registros y no la suma de sus unidades. |
| CA-07.2 | **Dado** productos con stock 0, 5 y 6, **cuando** consulto el resumen, **entonces** hay dos productos con stock bajo porque el umbral es `stock <= 5`. |
| CA-07.3 | **Dado** que creo, edito, elimino o reservo/devuelvo unidades mediante un presupuesto, **cuando** la operación termina correctamente, **entonces** los indicadores reflejan los datos actualizados. |
| CA-07.4 | **Dado** que el inventario está vacío, **cuando** consulto el resumen, **entonces** productos registrados, unidades en stock y productos con stock bajo devuelven cero. |

### HU-08 — Crear y descargar presupuestos

**Como** encargado, **quiero** seleccionar productos y cantidades, **para** emitir un presupuesto con el detalle y el precio total en PDF.

**Reglas relacionadas:** RN-19 y RN-20.

| ID | Criterio de aceptación |
|---|---|
| CA-08.1 | **Dado** entre 1 y 50 productos distintos con stock suficiente, **cuando** confirmo un presupuesto con cantidades enteras positivas, **entonces** el servidor crea el presupuesto, captura las líneas y reserva el stock en una única transacción. |
| CA-08.2 | **Dado** una cantidad cero, negativa, decimal o superior al stock disponible, **cuando** intento emitir el presupuesto, **entonces** el backend rechaza la operación sin crear el presupuesto ni modificar ninguna cantidad. |
| CA-08.3 | **Dado** un presupuesto que contiene más de 50 productos o repite el mismo producto en varias líneas, **cuando** intento emitirlo, **entonces** el backend rechaza la solicitud completa. |
| CA-08.4 | **Dado** un presupuesto con varias líneas donde una no tiene stock suficiente, **cuando** confirmo la emisión, **entonces** se revierte toda la transacción y ninguna línea descuenta stock. |
| CA-08.5 | **Dado** productos cuyo nombre o precio puede cambiar después, **cuando** emito el presupuesto, **entonces** el servidor toma los datos vigentes desde la base y conserva una fotografía histórica independiente del catálogo. |
| CA-08.6 | **Dado** un presupuesto emitido, **cuando** descargo su PDF desde el listado o detalle, **entonces** el documento incluye número, fecha, productos, cantidades, precios unitarios, subtotales y total en ARS. |

### HU-09 — Resolver presupuestos

**Como** encargado, **quiero** marcar un presupuesto como pagado o rechazado, **para** reflejar el resultado de la operación y mantener el inventario correcto.

**Reglas relacionadas:** RN-19, RN-20, RN-21 y RN-22.

| ID | Criterio de aceptación |
|---|---|
| CA-09.1 | **Dado** un presupuesto nuevo, **cuando** se confirma su creación, **entonces** queda en estado `issued` y la interfaz lo muestra como **Emitido**. |
| CA-09.2 | **Dado** un presupuesto emitido con stock ya reservado, **cuando** lo marco como pagado, **entonces** pasa a `paid`, sale de la lista de emitidos, permanece en el historial y no devuelve stock. |
| CA-09.3 | **Dado** un presupuesto emitido con stock reservado, **cuando** lo marco como rechazado, **entonces** pasa a `rejected`, sale de emitidos, permanece en el historial y devuelve exactamente una vez las cantidades reservadas. |
| CA-09.4 | **Dado** un presupuesto ya resuelto, **cuando** intento cambiar su estado nuevamente, **entonces** el backend rechaza la transición y no altera el stock. |
| CA-09.5 | **Dado** un producto asociado a un presupuesto emitido, **cuando** intento eliminarlo, **entonces** la operación se rechaza hasta que la reserva deje de estar activa. |
| CA-09.6 | **Dado** un presupuesto en el historial, **cuando** consulto o vuelvo a descargar su detalle, **entonces** se conservan los nombres, precios, cantidades, subtotales y total originales aunque el catálogo haya cambiado. |

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
| Se marca un presupuesto como pagado. | Sacarlo de emitidos, conservarlo en el historial y mantener descontado el stock. |
| Se marca un presupuesto como rechazado. | Devolver todo el stock reservado una sola vez y conservar el presupuesto en el historial. |
| Se intenta resolver por segunda vez un presupuesto. | Rechazar con conflicto y no modificar el stock. |
| Se intenta eliminar un producto con un presupuesto emitido. | Rechazar la eliminación para preservar la capacidad de devolver el stock. |

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
| `GET /api/budgets` | Listar presupuestos emitidos e históricos. |
| `GET /api/budgets/:id` | Consultar un presupuesto y sus líneas. |
| `GET /api/budgets/:id/pdf` | Descargar el PDF del presupuesto. |
| `PATCH /api/budgets/:id/status` | Marcar el presupuesto como `paid` o `rejected`. |

Las solicitudes y respuestas intercambian JSON, salvo que una respuesta no tenga cuerpo. Los errores deben utilizar códigos HTTP apropiados: `400` para datos inválidos, `404` para un producto inexistente y `500` para un error inesperado del servidor. Los errores JSON usan `{ "error": { "code": "...", "message": "...", "fields": {} } }`; `fields` se omite cuando no corresponda. Los códigos son `VALIDATION_ERROR`, `NOT_FOUND` e `INTERNAL_SERVER_ERROR`, respectivamente. Los errores internos no deben exponer detalles técnicos en la respuesta. El DTO de producto usa `id`, `name`, `description`, `category`, `price`, `stock`, `createdAt` y `updatedAt`; `price` es texto decimal exacto conforme a D-015 y no se devuelve `price_cents`. No se incluye `lowStock` sin una decisión que lo adopte. Ver D-016.

## 10. Requisitos no funcionales

- **Usabilidad:** formularios claros, etiquetas visibles, errores próximos al campo que corresponda y confirmación de operaciones destructivas.
- **Accesibilidad básica:** HTML semántico, controles utilizables con teclado, etiquetas asociadas a sus campos y contraste legible.
- **Consistencia:** ninguna operación inválida debe dejar los datos parcialmente actualizados.
- **Persistencia:** usar SQLite y comprobar que los datos sobreviven al reinicio del servidor.
- **Seguridad:** consultas parametrizadas, validación en servidor, manejo seguro del texto de usuario y ausencia de secretos en Git. La demo sin autenticación solo admite datos ficticios/de prueba.
- **Origen/CORS:** el backend sirve los archivos del frontend y la API en el mismo origen; el frontend solicita rutas relativas `/api`, por lo que no se requiere middleware CORS. Si se separan los servicios, se debe permitir únicamente el origen exacto del frontend mediante una allowlist, sin `*`. CORS no sustituye autenticación ni autorización.
- **Mantenibilidad:** código JavaScript legible, responsabilidades claras y dependencias limitadas.
- **Errores:** mensajes entendibles para el usuario y detalles técnicos solo en registros de desarrollo apropiados.
- **Idioma:** interfaz y mensajes en español.

## 11. Matriz de trazabilidad RN-HU

| Reglas de negocio | Historias de usuario relacionadas |
|---|---|
| RN-01 a RN-04 | HU-02, HU-03, HU-06 |
| RN-05 | HU-03, HU-06 |
| RN-06 y RN-07 | HU-06 |
| RN-08 a RN-11 | HU-07 |
| RN-12 a RN-15 | HU-01, HU-05 |
| RN-16 | HU-04 |
| RN-17 y RN-18 | HU-01 a HU-09, en las operaciones que modifican o consultan datos |
| RN-19 y RN-20 | HU-08, HU-09 |
| RN-21 | HU-09 |
| RN-22 | HU-03, HU-04, HU-08, HU-09 |

## 12. Criterios globales para considerar terminado el MVP

El MVP se considera terminado cuando:

1. Las nueve historias de usuario de esta especificación pasan sus criterios de aceptación.
2. Las reglas RN-01 a RN-22 se cumplen en la API, no solo en el navegador.
3. Los datos persisten tras reiniciar el servidor.
4. Se comprueban al menos los casos límite de la sección 8, mediante pruebas automatizadas de backend o comprobaciones manuales documentadas cuando corresponda.
5. El frontend informa correctamente de los estados de carga, éxito, vacío y error necesarios.
6. El README contiene instrucciones reales y verificadas de instalación, ejecución y pruebas.
7. No hay funcionalidades adicionales fuera de alcance que introduzcan reglas no aprobadas.

## 13. Documentos relacionados

- `idea.md`: contexto y necesidad original.
- `decisiones.md`: decisiones funcionales y técnicas adoptadas.
- `preguntas-abiertas.md`: decisiones de alcance futuro expresamente excluidas del MVP actual.
- `glosario.md`: terminología del dominio.
- `../AGENTS.md`: instrucciones generales para agentes.
- `../rules/`: reglas por rol.

## Historial de cambios

- [cambio] 2026-10-22 — Se redacta la primera especificación del MVP a partir de la idea y de las decisiones iniciales.
- [cambio] 2026-10-28 — RN-03 y el contrato de producto precisan el transporte de `price` como texto decimal exacto, conforme a D-015.
- [cambio] 2026-11-02 — Se incorporan reglas, historias, casos límite y endpoints para presupuestos, PDF, reservas de stock y resolución de operaciones.
- [cambio] 2026-11-02 — La búsqueda del inventario filtra al escribir y el stock se edita dentro del formulario del producto; se elimina la acción independiente de ajuste.
- [cambio] 2026-11-15 — Se unifica el estado de los presupuestos en `issued` (Emitido), `paid` y `rejected`, y se documenta la migración de bases anteriores.

- [cambio] 2026-11-15 — Se actualizan los criterios globales para incluir las 9 HU y RN-01 a RN-22, incluyendo presupuestos y reservas.

- [cambio] 2026-11-16 — Se normalizan las nueve historias con criterios Dado/Cuando/Entonces, se vinculan expresamente con sus RN y se alinea el alcance con la demo académica sin autenticación y la política same-origin/CORS.
