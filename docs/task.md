# Plan de tareas — Stock Simple

**Estado:** backlog inicial; la implementación todavía no comenzó.  
**Última actualización:** 2026-10-28.  
**Contrato funcional:** [`spec.md`](spec.md).  
**Plan técnico:** [`plan.md`](plan.md).

Este archivo divide el MVP en cambios pequeños, ordenados por dependencia técnica. Cada tarea tiene un agente responsable, alcance acotado, reglas e historias relacionadas, dependencias y casos concretos para comprobar su finalización.

> **Estado inicial:** todas las tareas comienzan como `[ ]` pendientes. No se debe marcar `[x]` hasta implementar el cambio y ejecutar satisfactoriamente todos los casos indicados. Los casos manuales deben dejar evidencia breve en el resultado de la tarea (por ejemplo, comando ejecutado y resultado observado).

## Cómo trabajar con este backlog

- Ejecutar las tareas en el orden indicado dentro de cada etapa. No empezar una tarea mientras alguna dependencia siga pendiente.
- Mantener cada cambio fácil de revisar: como referencia, intentar modificar pocos archivos relacionados, idealmente entre 2 y 5. Si una tarea requiere un cambio transversal mayor, dividirla antes de implementarla.
- `RN` hace referencia a las reglas de negocio y `HU` a las historias de usuario de `spec.md`. La referencia indica cobertura de esa tarea; **no significa que una HU esté terminada hasta que pasen también las tareas dependientes y las pruebas integrales**.
- Las pruebas de backend deben comprobar la API directamente, no solamente el comportamiento del formulario del navegador.
- Si un caso revela una contradicción documental, detener el cambio, aclararla en `decisiones.md` y actualizar `spec.md` si cambia el comportamiento observable. No adaptar el resultado esperado para hacer pasar el código.
- Los estados de carga, error, vacío y éxito deben verificarse donde correspondan. Nunca se debe mostrar una operación como exitosa antes de recibir una respuesta exitosa del servidor.

---

# Etapa 1 — Persistencia y reglas de negocio

**Objetivo:** construir y probar la base del dominio sin depender todavía de la interfaz web.

- [x] **T-01 — Inicializar el backend y el esquema SQLite**
  - **Agente:** Base de datos, con apoyo de Backend.
  - **Qué hace:** preparar la configuración mínima de Node.js para ejecutar el backend y las pruebas, abrir SQLite desde una ruta persistente e inicializar la tabla `products` con los tipos, campos obligatorios y restricciones del plan técnico. No desarrollar aún la interfaz.
  - **Archivos previstos:** `backend/package.json`, `backend/src/db/`, pruebas de esquema en `backend/test/` y, si hace falta, `.gitignore`.
  - **RN / HU:** RN-03, RN-04, RN-17; soporte técnico para HU-02 y HU-06.
  - **Depende de:** ninguna.
  - **Terminada cuando se compruebe:**
    1. Con una base nueva, la consulta de cantidad de registros devuelve `0`.
    2. Se puede guardar un producto de prueba con `price_cents = 0` y `stock = 0`.
    3. La base rechaza un registro con `price_cents = -1` y otro con `stock = -1`.
    4. Se guarda un producto `Mouse`, categoría `Periféricos`, `price_cents = 125050` y `stock = 5`; después de cerrar y volver a abrir la conexión, siguen existiendo los mismos valores.

- [x] **T-02 — Implementar el repositorio de productos**
  - **Agente:** Backend.
  - **Qué hace:** implementar las operaciones de acceso a datos para crear, obtener por identificador, listar, actualizar y eliminar productos. Usar consultas parametrizadas y devolver resultados claros cuando el identificador no exista.
  - **Archivos previstos:** `backend/src/repositories/products.repository.js` y sus pruebas unitarias.
  - **RN / HU:** RN-09, RN-16, RN-17; soporte para HU-01, HU-02, HU-03 y HU-04.
  - **Depende de:** T-01.
  - **Terminada cuando se compruebe:**
    1. Crear dos productos llamados `Mouse` devuelve dos identificadores diferentes y ambos registros siguen disponibles.
    2. Obtener cada identificador devuelve únicamente el producto correspondiente.
    3. Actualizar el precio del primer producto no modifica el segundo producto.
    4. Eliminar el primer producto deja al segundo disponible; intentar obtener el identificador eliminado devuelve “no encontrado” y no elimina otros registros.
    5. La prueba de integración del repositorio confirma que los datos creados siguen presentes al reabrir la base de datos.

- [x] **T-03 — Implementar validación y normalización de productos**
  - **Agente:** Backend.
  - **Qué hace:** centralizar en el servicio las reglas de creación y edición: campos obligatorios, recorte de espacios, límites de longitud, precio en ARS y stock inicial. La edición solo cambia nombre, descripción, categoría y precio; no el stock.
  - **Archivos previstos:** `backend/src/services/products.service.js` y pruebas del servicio.
  - **RN / HU:** RN-01, RN-02, RN-03, RN-04, RN-05, RN-18; HU-02 y HU-03.
  - **Depende de:** T-02.
  - **Terminada cuando se compruebe:**
    1. Crear con nombre `  Mouse  ` y categoría ` Periféricos ` guarda `Mouse` y `Periféricos`.
    2. Crear con nombre compuesto solo por espacios o categoría vacía se rechaza y no crea ningún registro.
    3. Se aceptan los precios textuales `"0"` y `"1250.50"`; se rechazan `"-1"`, `"abc"` y `"1250.505"`.
    4. Se aceptan nombres de 100 caracteres, descripciones de 500 caracteres y categorías de 50 caracteres; se rechazan, respectivamente, 101, 501 y 51 caracteres.
    5. Se acepta stock inicial `0`; se rechazan `-1`, `1.5` y un valor no numérico.
    6. Un producto con stock `5` recibe una edición que incluye `stock: 99`; los campos editables cambian, pero el stock continúa en `5`.
    7. Una edición inválida deja sin cambios todos los valores previos del producto.

- [x] **T-04 — Implementar los ajustes de stock en el servicio**
  - **Agente:** Backend.
  - **Qué hace:** implementar el aumento y la disminución mediante una operación explícita y una cantidad entera positiva. Rechazar una disminución superior al stock disponible sin alterar el valor guardado.
  - **Archivos previstos:** `backend/src/services/stock.service.js` (o el módulo de productos si mantenerlo separado no aporta claridad) y sus pruebas.
  - **RN / HU:** RN-04, RN-06, RN-07, RN-18; HU-06.
  - **Depende de:** T-02 y T-03.
  - **Terminada cuando se compruebe:**
    1. Dado un producto con stock `8`, aumentar `3` deja stock `11`.
    2. Sobre ese producto, disminuir `4` deja stock `7`.
    3. Intentar disminuir `8` cuando el stock es `7` se rechaza y el stock continúa en `7`.
    4. Cantidades `0`, `-1` y `1.5` se rechazan y no cambian el stock.
    5. Una operación sobre un identificador inexistente devuelve el resultado “no encontrado” y no modifica ningún producto.
    6. Dos solicitudes concurrentes de disminución no pueden dejar stock negativo ni confirmar una disminución que exceda el stock disponible.

- [x] **T-05 — Implementar búsqueda, filtro y orden del listado**
  - **Agente:** Backend.
  - **Qué hace:** ofrecer la consulta de productos ordenada alfabéticamente por nombre, con búsqueda parcial sin distinguir mayúsculas y minúsculas y filtro por categoría completa. La búsqueda y el filtro deben combinarse.
  - **Archivos previstos:** `backend/src/repositories/products.repository.js`, `backend/src/services/products.service.js` y pruebas del listado.
  - **RN / HU:** RN-12, RN-13, RN-14, RN-15; HU-01 y HU-05.
  - **Depende de:** T-02 y T-03.
  - **Terminada cuando se compruebe:** con estos datos —`Mouse inalámbrico` / `Periféricos`, `Teclado` / `Periféricos`, `Mousepad` / `Accesorios`—:
    1. Sin filtros se devuelven los tres productos en orden alfabético por nombre.
    2. Buscar `  mOuSe ` devuelve `Mouse inalámbrico` y `Mousepad`.
    3. Filtrar por categoría `periféricos` devuelve `Mouse inalámbrico` y `Teclado`.
    4. Buscar `mouse` y filtrar por `Accesorios` al mismo tiempo devuelve solamente `Mousepad`.
    5. Buscar `router` devuelve una lista vacía, no un error técnico.
    6. Una búsqueda vacía y sin categoría seleccionada vuelve a devolver todos los productos.

- [x] **T-06 — Calcular los indicadores del inventario**
  - **Agente:** Backend.
  - **Qué hace:** calcular productos registrados, suma de unidades en stock y cantidad de productos cuyo stock es menor o igual que cinco. Los indicadores se calculan a partir de la tabla de productos; no se almacenan como contadores separados.
  - **Archivos previstos:** `backend/src/repositories/summary.repository.js` (o consulta equivalente), `backend/src/services/summary.service.js` y pruebas.
  - **RN / HU:** RN-08, RN-09, RN-10, RN-11; HU-07.
  - **Depende de:** T-01 y T-02.
  - **Terminada cuando se compruebe:**
    1. Con la base vacía, los resultados son `productsCount = 0`, `unitsInStock = 0` y `lowStockCount = 0`.
    2. Con tres productos cuyos stocks son `0`, `5` y `6`, el resultado es `productsCount = 3`, `unitsInStock = 11` y `lowStockCount = 2`.
    3. Si el producto con stock `0` se elimina, los resultados pasan a `productsCount = 2`, `unitsInStock = 11` y `lowStockCount = 1`.

---

# Etapa 2 — API REST

**Objetivo:** exponer las operaciones probadas por medio de HTTP/JSON y verificar las reglas también cuando se llama directamente a la API, sin pasar por el navegador.

- [x] **T-07 — Implementar consulta y listado de productos en la API**
  - **Agente:** Backend.
  - **Qué hace:** configurar la aplicación Express, las rutas y los controllers de lectura para `GET /api/products` y `GET /api/products/:id`. Conservar los filtros `search` y `category` y acordar/documentar un formato de error consistente con la propuesta de `plan.md` antes de conectar el frontend.
  - **Archivos previstos:** `backend/src/app.js`, rutas y controller de productos, pruebas HTTP y, si corresponde, `docs/decisiones.md` para fijar el contrato técnico del error.
  - **RN / HU:** RN-12, RN-13, RN-14, RN-15, RN-18; HU-01 y HU-05.
  - **Depende de:** T-03 y T-05.
  - **Terminada cuando se compruebe:**
    1. `GET /api/products` con inventario vacío responde `200` y una lista vacía.
    2. Con `Mouse` y `Teclado` guardados, `GET /api/products` devuelve los productos en el orden establecido en RN-15.
    3. `GET /api/products?search=mouse&category=Periféricos` devuelve solamente los registros que cumplen ambos filtros.
    4. `GET /api/products/999999` responde `404` y no altera los productos existentes.
    5. Una falla simulada de lectura produce una respuesta de error controlada; no devuelve una lista ficticia como si fuese real ni una traza interna.

- [x] **T-08 — Implementar alta de productos en la API**
  - **Agente:** Backend.
  - **Qué hace:** implementar `POST /api/products`, recibir el producto, delegar la validación al servicio y devolver el registro creado con identificador y marcas de tiempo del sistema.
  - **Archivos previstos:** controller/ruta de productos y pruebas HTTP de creación.
  - **RN / HU:** RN-01, RN-02, RN-03, RN-04, RN-17, RN-18; HU-02.
  - **Depende de:** T-03 y T-07.
  - **Terminada cuando se compruebe:**
    1. Enviar `{ "name": "  Mouse  ", "category": " Periféricos ", "price": "1250.50", "stock": 5, "description": "" }` responde `201`; el recurso devuelto tiene `name = "Mouse"`, `category = "Periféricos"`, `price = "1250.50"` y `stock = 5`, además de `id`, `createdAt` y `updatedAt` generados.
    2. Enviar nombre vacío o categoría vacía responde `400` y la cantidad de productos no aumenta.
    3. Enviar precio `"-1"`, `"abc"` o `"1250.505"` responde `400` y no crea registros.
    4. Enviar stock `-1` o `1.5` responde `400` y no crea registros.
    5. Enviar un producto válido con nombre ya existente crea un segundo registro independiente, no reemplaza el primero.

- [x] **T-09 — Implementar edición de productos en la API**
  - **Agente:** Backend.
  - **Qué hace:** implementar `PUT /api/products/:id` para actualizar únicamente nombre, descripción, categoría y precio. La solicitud inválida no puede dejar datos parcialmente modificados.
  - **Archivos previstos:** controller/ruta de productos y pruebas HTTP de actualización.
  - **RN / HU:** RN-01, RN-02, RN-03, RN-05, RN-16, RN-18; HU-03.
  - **Depende de:** T-03 y T-08.
  - **Terminada cuando se compruebe:**
    1. Un producto con nombre `Mouse`, precio `1000` y stock `5` se actualiza a nombre `Mouse Pro` y precio `1500`; la respuesta `200` refleja los cambios y stock `5`.
    2. Si la petición incluye además `stock: 99`, la respuesta y la base siguen mostrando stock `5`.
    3. Una actualización con categoría formada por espacios responde `400`; nombre, categoría, precio y stock permanecen en sus valores anteriores.
    4. Actualizar `/api/products/999999` responde `404` y no modifica ningún otro registro.

- [x] **T-10 — Implementar eliminación de productos en la API**
  - **Agente:** Backend.
  - **Qué hace:** implementar `DELETE /api/products/:id`. La confirmación de usuario pertenece al frontend; el backend debe eliminar solo el identificador solicitado e informar cuando no exista.
  - **Archivos previstos:** controller/ruta de productos y pruebas HTTP de eliminación.
  - **RN / HU:** RN-16, RN-17; HU-04.
  - **Depende de:** T-02 y T-07.
  - **Terminada cuando se compruebe:**
    1. Con productos de ID `1` y `2`, `DELETE /api/products/1` responde `204`; consultar el ID `1` responde `404` y el ID `2` continúa disponible.
    2. `DELETE /api/products/999999` responde `404` y el producto de ID `2` sigue sin cambios.

- [x] **T-11 — Implementar ajuste de stock en la API**
  - **Agente:** Backend.
  - **Qué hace:** implementar `PATCH /api/products/:id/stock`, usando `operation = increase|decrease` y `quantity` entero positivo. Traducir los rechazos a errores HTTP controlados.
  - **Archivos previstos:** controller/ruta de stock y pruebas HTTP de ajustes.
  - **RN / HU:** RN-04, RN-06, RN-07, RN-18; HU-06.
  - **Depende de:** T-04 y T-07.
  - **Terminada cuando se compruebe:**
    1. Con stock `8`, `PATCH` con `{ "operation": "increase", "quantity": 3 }` responde `200` y stock `11`.
    2. Con stock `11`, `{ "operation": "decrease", "quantity": 4 }` responde `200` y stock `7`.
    3. Con stock `7`, intentar disminuir `8` responde `400` y el stock sigue en `7`.
    4. Cantidad `0`, `-1` o `1.5`, u operación `"reset"`, responde `400` y no altera el stock.
    5. Un ID inexistente responde `404`.

- [x] **T-12 — Exponer el resumen del inventario en la API**
  - **Agente:** Backend.
  - **Qué hace:** implementar `GET /api/summary`, devolviendo los tres indicadores calculados por el servicio. No duplicar la lógica de conteo en el controller.
  - **Archivos previstos:** ruta/controller del resumen y pruebas HTTP.
  - **RN / HU:** RN-08, RN-09, RN-10, RN-11, RN-17; HU-07.
  - **Depende de:** T-06 y T-07.
  - **Terminada cuando se compruebe:**
    1. Con inventario vacío, `GET /api/summary` responde `200` con `productsCount = 0`, `unitsInStock = 0` y `lowStockCount = 0`.
    2. Con productos de stock `0`, `5` y `6`, responde `productsCount = 3`, `unitsInStock = 11` y `lowStockCount = 2`.
    3. Después de aumentar el producto de stock `5` en `2`, el resumen cambia a `productsCount = 3`, `unitsInStock = 13` y `lowStockCount = 1`.

---

# Etapa 3 — Interfaz web

**Objetivo:** implementar la interfaz con HTML, CSS y JavaScript sin framework. Todo dato persistente se obtiene y modifica por la API.

- [x] **T-13 — Crear la pantalla principal y el listado**
  - **Agente:** Frontend.
  - **Qué hace:** crear la estructura de la página, tabla de productos y estados de carga, inventario vacío y error del servidor. Mostrar nombre, categoría, precio y stock; no incluir controles para operaciones aún no implementadas.
  - **Archivos previstos:** `frontend/index.html`, `frontend/css/styles.css`, `frontend/js/api.js`, `frontend/js/app.js`.
  - **RN / HU:** RN-15; HU-01; D-017.
  - **Depende de:** T-07.
  - **Terminada cuando se compruebe:**
    1. Con inventario vacío, la pantalla muestra un mensaje claro; no muestra controles de alta hasta que el formulario funcional esté implementado en T-14.
    2. Con `Mouse`, categoría `Periféricos`, precio `1250.50` y stock `5`, la fila muestra esos datos y no presenta controles decorativos para acciones pendientes.
    3. Si la API devuelve un error, se muestra un mensaje comprensible y no se inventa una lista vacía o datos de ejemplo como si fueran reales.
    4. Se puede recorrer la pantalla y operar sus controles existentes mediante teclado, con foco visible y nombres accesibles.
  - **Verificación:** `node --test frontend/test/t13.test.js` (10/10) y `npm --prefix backend test` (108/108).

- [ ] **T-14 — Crear el formulario de alta de productos**
  - **Agente:** Frontend.
  - **Qué hace:** incorporar los campos nombre, categoría, precio, stock inicial y descripción opcional. Enviar la solicitud de creación a la API y mostrar el resultado real.
  - **Archivos previstos:** frontend, formulario y estilos existentes; mantener el cambio acotado a un máximo de unos pocos archivos.
  - **RN / HU:** RN-01, RN-02, RN-03, RN-04, RN-18; HU-02; D-017.
  - **Depende de:** T-08 y T-13.
  - **Terminada cuando se compruebe:**
    1. Cargar nombre `Mouse`, categoría `Periféricos`, precio `1250.50` y stock `5` crea el producto, cierra o limpia el formulario de manera coherente y muestra el registro en el listado.
    2. Intentar enviar nombre vacío, precio negativo o stock decimal muestra el error correspondiente y no presenta el alta como exitosa.
    3. Un error `400` devuelto por la API se muestra al usuario y el formulario conserva información suficiente para corregir los campos.

- [ ] **T-15 — Crear la edición de productos**
  - **Agente:** Frontend.
  - **Qué hace:** permitir seleccionar un producto, cargar los valores actuales y guardar cambios descriptivos/comerciales. No ofrecer un campo de stock en el formulario de edición.
  - **Archivos previstos:** `frontend/js/app.js`, estructura del formulario y estilos relacionados.
  - **RN / HU:** RN-05, RN-18; HU-03.
  - **Depende de:** T-09 y T-13.
  - **Terminada cuando se compruebe:**
    1. Editar `Mouse` a `Mouse Pro` y cambiar el precio de `1000` a `1500` muestra los nuevos datos y conserva stock `5`.
    2. La interfaz de edición no permite cambiar el stock.
    3. Si la API responde `404`, se informa que el producto ya no existe; si responde error de validación, no se muestran falsamente los cambios como guardados.

- [ ] **T-16 — Incorporar eliminación con confirmación**
  - **Agente:** Frontend.
  - **Qué hace:** pedir confirmación clara que identifique el producto antes de enviar `DELETE`. Actualizar la lista y el resumen solamente si la eliminación se confirma y la API responde exitosamente.
  - **Archivos previstos:** `frontend/js/app.js` y el componente/markup de confirmación si se separa.
  - **RN / HU:** RN-16; HU-04 y HU-07.
  - **Depende de:** T-10 y T-13.
  - **Terminada cuando se compruebe:**
    1. Al cancelar la confirmación de borrar `Mouse`, no se envía `DELETE` y el producto sigue visible.
    2. Al confirmar, la API recibe el ID correcto y el producto desaparece del listado después de una respuesta exitosa.
    3. Si la API devuelve error, el producto no se elimina visualmente como si la operación hubiera tenido éxito y se informa el problema. La actualización del resumen se comprueba en T-19.

- [ ] **T-17 — Conectar búsqueda y filtro por categoría**
  - **Agente:** Frontend.
  - **Qué hace:** añadir búsqueda por nombre, filtro de categoría, combinación de ambas condiciones y acción para limpiar los filtros. Mostrar el estado sin resultados.
  - **Archivos previstos:** `frontend/index.html`, `frontend/js/api.js` o `frontend/js/app.js`, estilos de controles.
  - **RN / HU:** RN-12, RN-13, RN-14, RN-15; HU-05.
  - **Depende de:** T-05, T-07 y T-13.
  - **Terminada cuando se compruebe:** usando `Mouse inalámbrico`/`Periféricos`, `Teclado`/`Periféricos` y `Mousepad`/`Accesorios`:
    1. Buscar `mOuSe` muestra `Mouse inalámbrico` y `Mousepad`.
    2. Seleccionar `Periféricos` muestra `Mouse inalámbrico` y `Teclado`.
    3. Combinar búsqueda `mouse` y categoría `Accesorios` muestra solo `Mousepad`.
    4. Buscar `router` muestra un estado sin resultados.
    5. Limpiar los filtros vuelve a mostrar los tres registros.

- [ ] **T-18 — Incorporar el ajuste de stock en la interfaz**
  - **Agente:** Frontend.
  - **Qué hace:** permitir elegir aumentar o disminuir, ingresar una cantidad positiva y ejecutar el endpoint específico. Actualizar el stock visible solo después de una respuesta exitosa.
  - **Archivos previstos:** `frontend/js/app.js`, formulario/markup de ajuste y estilos relacionados.
  - **RN / HU:** RN-04, RN-05, RN-06, RN-07, RN-18; HU-06.
  - **Depende de:** T-11 y T-13.
  - **Terminada cuando se compruebe:**
    1. Un producto con stock `5`, al aumentar `2`, pasa a mostrar stock `7` tras recibir éxito de la API.
    2. Intentar disminuir `8` cuando el stock es `7` muestra el error y mantiene `7` en pantalla.
    3. Cantidad `0` o `1.5` se rechaza y no produce un cambio de stock.
    4. Si el servidor falla, la interfaz informa el error y no simula el cambio.

- [ ] **T-19 — Mostrar y actualizar el resumen del inventario**
  - **Agente:** Frontend.
  - **Qué hace:** mostrar productos registrados, unidades totales y productos con stock bajo a partir de `GET /api/summary`. Actualizar los indicadores después de altas, ediciones, eliminaciones y ajustes exitosos.
  - **Archivos previstos:** `frontend/js/api.js`, `frontend/js/app.js`, markup y estilos de indicadores.
  - **RN / HU:** RN-08, RN-09, RN-10, RN-11; HU-07.
  - **Depende de:** T-12, T-13, T-14, T-15, T-16 y T-18.
  - **Terminada cuando se compruebe:**
    1. Con inventario vacío se muestran `0` productos, `0` unidades y `0` productos con stock bajo.
    2. Con tres productos que tienen stocks `0`, `5` y `6`, se muestran `3`, `11` y `2`, respectivamente.
    3. Al aumentar el producto con stock `5` en `2`, los indicadores pasan a `3`, `13` y `1`.
    4. Al eliminar el producto con stock `0`, los indicadores pasan a `2`, `11` y `1`.

---

# Etapa 4 — Integración, regresión y cierre

**Objetivo:** comprobar el comportamiento de punta a punta y dejar instrucciones fiables para ejecutar el proyecto.

- [ ] **T-20 — Ejecutar pruebas integrales y corregir regresiones del MVP**
  - **Agente:** Testing y QA, con participación de Backend y Frontend para corregir defectos.
  - **Qué hace:** verificar el recorrido completo desde la interfaz hasta SQLite, cubrir las siete historias de usuario y revisar los casos límite de `spec.md`. Mantener los casos automatizados donde sea razonable y documentar los controles manuales que queden.
  - **Archivos previstos:** `backend/test/`, pruebas de integración/e2e si se incorporan, y correcciones pequeñas en los módulos con fallos.
  - **RN / HU:** RN-01 a RN-18; HU-01 a HU-07.
  - **Depende de:** T-01 a T-19.
  - **Terminada cuando se compruebe:**
    1. Crear `Mouse` con precio `1250.50` y stock `5` lo muestra en el listado y produce resumen `1` producto, `5` unidades y `1` producto con stock bajo.
    2. Aumentar el stock en `2` lo deja en `7` y cambia el resumen a `1`, `7`, `0`.
    3. Intentar disminuir `8` con stock `7` produce un error; el stock y el resumen no cambian.
    4. Una edición normal que incluya `stock: 99` no cambia el stock real.
    5. Buscar por nombre y categoría combinados devuelve solo la coincidencia esperada; una búsqueda sin coincidencias muestra el estado vacío correspondiente.
    6. Cancelar un borrado conserva el producto; confirmarlo lo elimina y actualiza el resumen.
    7. Tras crear un producto, detener y volver a iniciar el servidor conserva el producto y sus datos.
    8. Una petición inválida enviada directamente a la API, sin usar el formulario, es rechazada y no modifica la base.
    9. Todos los casos de borde de la sección 8 de `spec.md` tienen una prueba automatizada o una comprobación manual documentada.

- [ ] **T-21 — Documentar ejecución, pruebas y límites de uso**
  - **Agente:** Documentación, con verificación de Backend.
  - **Qué hace:** actualizar el README con los comandos reales de instalación, inicialización, ejecución y pruebas; describir la estructura implementada y recordar que el MVP no incluye autenticación. No documentar funciones que no existan.
  - **Archivos previstos:** `README.md` y, si el código final lo exige, los enlaces de `docs/plan.md` o `docs/task.md`.
  - **RN / HU:** RN-17 y requisito no funcional de seguridad; soporte al cierre de HU-01 a HU-07.
  - **Depende de:** T-20.
  - **Terminada cuando se compruebe:**
    1. Siguiendo el README desde una copia limpia del repositorio, se pueden instalar las dependencias, ejecutar las pruebas e iniciar la aplicación con los comandos documentados.
    2. Con los comandos del README, crear `Mouse` con stock `5`, reiniciar el servidor y volver a consultar el producto devuelve el mismo stock `5`.
    3. El README explica que la versión sin autenticación es solo para uso local o controlado y no debe publicarse abiertamente en Internet.
    4. Los comandos documentados fueron ejecutados realmente; no quedan marcadores de posición ni instrucciones inventadas.

---

## Trazabilidad resumida

| Área de `spec.md` | Tareas principales |
|---|---|
| Modelo de datos y persistencia | T-01, T-02, T-20, T-21 |
| RN-01 a RN-05: datos y edición | T-03, T-08, T-09, T-14, T-15 |
| RN-06 y RN-07: ajuste de stock | T-04, T-11, T-18 |
| RN-08 a RN-11: indicadores | T-06, T-12, T-19 |
| RN-12 a RN-15: consulta y filtros | T-05, T-07, T-17 |
| RN-16: eliminación | T-02, T-10, T-16 |
| RN-17 y RN-18: persistencia y validación en backend | T-01 a T-12, T-20, T-21 |
| HU-01: consultar inventario | T-02, T-05, T-07, T-13, T-20 |
| HU-02: registrar producto | T-01, T-03, T-08, T-14, T-20 |
| HU-03: editar producto | T-02, T-03, T-09, T-15, T-20 |
| HU-04: eliminar producto | T-02, T-10, T-16, T-20 |
| HU-05: buscar y filtrar | T-05, T-07, T-17, T-20 |
| HU-06: ajustar stock | T-01, T-04, T-11, T-18, T-20 |
| HU-07: resumen y reposición | T-06, T-12, T-19, T-20 |

## Historial de cambios

- [cambio] 2026-10-28 — Se crea el backlog inicial, ordenado por dependencias, con criterios de finalización verificables derivados de las reglas, historias de usuario y casos límite de `spec.md`.
- [cambio] 2026-10-28 — Se alinean el criterio de precio de T-03 y el ejemplo de T-08 con D-015, que define `price` como texto decimal exacto.
