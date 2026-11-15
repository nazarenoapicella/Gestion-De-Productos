# Plan técnico — Stock Simple

> **Estado:** arquitectura implementada y vigente; esta documentación describe el sistema construido.  
> **Responsable de elaboración:** agente arquitecto.  
> **Alcance:** MVP definido en [`spec.md`](spec.md).  
> **Última actualización:** 2026-11-15.

Este documento explica cómo se propone construir el sistema a partir de los requisitos actuales. No reemplaza la especificación funcional ni autoriza funciones que estén fuera del MVP. Si el plan contradice una regla de negocio de `spec.md` o una decisión adoptada en `decisiones.md`, se debe registrar la contradicción y resolverla antes de programar.

## 1. ¿Cómo se organiza el sistema?

### 1.1 Arquitectura general

Se usará una aplicación web sencilla con frontend estático, backend Node.js + Express y base de datos SQLite. Express servirá los archivos del frontend y expondrá la API bajo `/api`, por lo que en el entorno local el navegador y la API usarán el mismo origen.

```text
Usuario
  │
  ▼
Frontend: HTML + CSS + JavaScript
  │  HTTP / JSON
  ▼
Rutas de Express
  │
  ▼
Controller  ── interpreta la petición HTTP y construye la respuesta
  │
  ▼
Service     ── aplica y coordina las reglas de negocio
  │
  ▼
Repository  ── ejecuta consultas parametrizadas contra SQLite
  │
  ▼
Base de datos: stock-simple.sqlite
```

### 1.2 Responsabilidades por capa

- **Routes:** relacionan el método y la ruta HTTP con el controller correspondiente. No contienen reglas de negocio ni consultas SQL.
- **Controller:** lee parámetros, query strings y cuerpos JSON; llama al service y traduce el resultado a códigos HTTP y JSON. No calcula el stock ni decide si una operación de negocio es válida.
- **Service:** centraliza las reglas de negocio, valida y normaliza datos, coordina operaciones y determina resultados como producto inexistente o stock insuficiente. Es la ubicación principal de las reglas RN-01 a RN-18; las reglas de presupuesto RN-19 a RN-22 se coordinan con el repositorio de presupuestos para garantizar atomicidad.
- **Repository:** concentra las consultas SQL y la persistencia. Usa parámetros SQL, devuelve datos o resultados explícitos y no construye mensajes de interfaz.
- **Módulo de base de datos:** configura la conexión y asegura que el esquema inicial exista. No contiene reglas propias del comercio.
- **Frontend:** muestra los datos y permite operar el sistema. Puede validar campos para facilitar el uso, pero el backend es siempre la autoridad final.

Las capas deben ser pequeñas. No se crearán interfaces genéricas, patrones adicionales ni módulos vacíos solo para cumplir una estructura. Si una función es demasiado pequeña para justificar un archivo separado, se mantendrá junto a la responsabilidad más cercana hasta que exista una razón concreta para separarla.

### 1.3 Estructura propuesta

La estructura de referencia se contrasta con el árbol real del repositorio. Los nombres de carpetas y archivos listados en README y este plan deben mantenerse sincronizados con la implementación.

```text
stock-simple/
├── README.md
├── AGENTS.md
├── .gitignore
├── docs/
│   ├── ideas.md
│   ├── decisiones.md
│   ├── preguntas-abiertas.md
│   ├── glosario.md
│   ├── spec.md
│   ├── plan.md
│   ├── tasks.md
│   ├── pruebas-manuales.md
│   └── INFORME-VERIFICACION.md
├── rules/
│   ├── analista-funcional.mdc
│   ├── arquitectura.mdc
│   ├── backend.mdc
│   ├── base-de-datos.mdc
│   ├── frontend.mdc
│   ├── testing-qa.mdc
│   └── documentacion.mdc
├── backend/
│   ├── .env.example
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── repositories/
│       └── db/
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── test/
    ├── css/
    │   └── styles.css
    └── js/
        ├── api.js
        └── app.js
```

Las pruebas automatizadas de backend están en `backend/test/`; las de interfaz están en `frontend/test/`.

`app.js` configurará Express y sus rutas; `server.js` iniciará el servidor. `api.js` centralizará las peticiones desde el frontend. Se pueden ajustar nombres de archivos durante la implementación, siempre que se mantengan las responsabilidades y el alcance definidos.

## 2. ¿Qué base de datos usamos y por qué?

Se utilizará **SQLite**.

- Guarda la información en un archivo local, por lo que no requiere instalar ni administrar un servidor de base de datos separado.
- Permite persistencia real: los productos siguen existiendo después de reiniciar Node.js o cerrar el navegador.
- Ofrece restricciones SQL que complementan la validación del backend.
- Es suficiente para un MVP local, de un único comercio y un único operador.
- Mantiene una ruta de aprendizaje sencilla antes de considerar una base de datos cliente-servidor para una futura versión.

La conexión debe apuntar a una ruta estable dentro de `backend/`, por ejemplo `backend/data/stock-simple.sqlite`, nunca a una base en memoria para el uso normal. El directorio de datos y el archivo de la base local deben quedar fuera de Git.

No se incorporará otra base de datos ni un ORM al MVP sin una necesidad concreta y una decisión documentada.

## 3. ¿Qué datos guardamos?

### 3.1 Entidad persistida: `Product`

En el MVP existe una sola entidad persistida: el producto. Las categorías son texto dentro del producto, no una tabla separada. No se guardan ventas, usuarios, proveedores ni movimientos históricos de stock.

| Campo lógico | Columna SQLite | Tipo | Reglas |
|---|---|---|---|
| Identificador | `id` | `INTEGER PRIMARY KEY` | Generado por SQLite; único y no elegido por el usuario. |
| Nombre | `name` | `TEXT NOT NULL` | Entre 1 y 100 caracteres después de quitar espacios externos. Los nombres repetidos están permitidos. |
| Descripción | `description` | `TEXT` | Opcional; máximo 500 caracteres. El valor vacío se normalizará a `NULL`. |
| Categoría | `category` | `TEXT NOT NULL` | Entre 1 y 50 caracteres después de quitar espacios externos. |
| Precio en centavos | `price_cents` | `INTEGER NOT NULL` | No negativo. Representa el precio en ARS sin errores de precisión decimal. |
| Stock actual | `stock` | `INTEGER NOT NULL` | Entero igual o mayor que cero. |
| Fecha de creación | `created_at` | `TEXT NOT NULL` | Fecha y hora generadas por el sistema, en formato ISO 8601 UTC. |
| Última modificación | `updated_at` | `TEXT NOT NULL` | Fecha y hora generadas por el sistema, en formato ISO 8601 UTC. |

Se usarán restricciones `CHECK` en SQLite para reforzar, como mínimo, los límites de longitud aplicables, `price_cents >= 0` y `stock >= 0`. Estas restricciones son una última barrera de integridad, no un reemplazo de la validación del service.

### 3.2 Precio y stock

- La interfaz y el contrato de la API representan `price` como texto decimal en ARS, con hasta dos cifras decimales. No se aceptan separadores de miles ni notación exponencial.
- Antes de persistir, el backend valida y convierte el texto a centavos enteros; al responder, vuelve a exponer `price` como texto decimal exacto con dos cifras decimales.
- Se rechazan importes cuyo `price_cents` exceda `Number.MAX_SAFE_INTEGER`, límite técnico requerido para operar con seguridad con enteros en JavaScript; no es un máximo comercial.
- El stock se guarda como entero. En ningún flujo se acepta una cantidad decimal o negativa.
- El stock solo puede cambiar al crear un producto o mediante la operación específica de ajuste; el endpoint de edición normal no puede modificarlo.

### 3.3 Resumen de inventario

Los tres indicadores no necesitan tablas separadas: se calculan a partir de `products`.

- `productsCount`: cantidad de registros (`COUNT(*)`).
- `unitsInStock`: suma de `stock` (`COALESCE(SUM(stock), 0)`).
- `lowStockCount`: cantidad de productos cuyo stock sea menor o igual a 5.

La categoría no necesita tabla propia y no se requiere una relación entre tablas para el MVP.

## 4. ¿Cómo se comunican frontend y backend?

La comunicación será una API REST con JSON bajo `/api`. Express servirá también los archivos del frontend. No se utilizará acceso directo desde el navegador a SQLite.

| Método y ruta | Uso | Respuesta exitosa esperada |
|---|---|---|
| `GET /api/products` | Listar productos; admite `search` y `category` opcionales. | `200` y una lista de productos. |
| `GET /api/products/:id` | Consultar un producto. | `200` y el producto, o `404` si no existe. |
| `POST /api/products` | Crear un producto con nombre, categoría, precio, stock inicial y descripción opcional. | `201` y el producto creado. |
| `PUT /api/products/:id` | Modificar nombre, descripción, categoría, precio y stock disponible. Nombre, categoría, precio y stock son obligatorios; descripción puede omitirse para conservarla. | `200` y el producto actualizado, `400` por datos inválidos o `404`. |
| `DELETE /api/products/:id` | Eliminar el producto indicado. | `204` sin cuerpo, o `404`. |
| `PATCH /api/products/:id/stock` | Aumentar o disminuir stock con `operation` y `quantity`. | `200` y el producto actualizado, o un error controlado. |
| `GET /api/summary` | Obtener los indicadores del inventario. | `200` con los tres indicadores. |

### 4.1 Convenciones del contrato

- `operation` será `increase` o `decrease`; `quantity` será un entero positivo.
- El DTO de producto tendrá `id`, `name`, `description`, `category`, `price` como texto decimal exacto, `stock`, `createdAt` y `updatedAt`, según D-016. No incluirá `lowStock` hasta que se adopte mediante una decisión.
- Las solicitudes envían `price` como texto decimal no negativo, sin agrupación de miles ni exponente, y con hasta dos cifras decimales. El backend lo convierte exactamente a centavos; las respuestas usan texto decimal con dos cifras.
- Las solicitudes de edición exigirán `name`, `category` y `price`; `description` es opcional y se conserva cuando se omite. Aunque el cliente envíe por error `stock`, ese campo nunca debe modificar el stock.
- Los códigos de error adoptados en D-016 son `400`/`VALIDATION_ERROR` para datos inválidos, `404`/`NOT_FOUND` para un producto inexistente y `500`/`INTERNAL_SERVER_ERROR` para un fallo inesperado. Los errores internos devuelven un mensaje genérico sin detalles técnicos.
- El formato común de error adoptado en D-016 es `{ "error": { "code": "...", "message": "...", "fields": {} } }`; `fields` puede omitirse cuando no corresponda.
- Se utilizarán consultas SQL parametrizadas y no se concatenará texto del usuario en el SQL.

El controller no debe duplicar reglas de negocio y el frontend no debe tratar una petición como exitosa hasta recibir una respuesta exitosa del servidor.

## 5. ¿Dónde vive cada regla de negocio?

La regla se define funcionalmente en `docs/spec.md`; su implementación principal estará en el service. La interfaz ofrece ayuda al usuario y SQLite añade restricciones de integridad cuando sea apropiado.

| Regla de `spec.md` | Implementación principal | Refuerzo o comportamiento complementario |
|---|---|---|
| RN-01 — Nombre obligatorio | `products.service` | Frontend indica el campo requerido; SQLite impide valores vacíos o fuera del límite. |
| RN-02 — Categoría obligatoria y reutilizable | `products.service` | Frontend indica el campo requerido; SQLite aplica restricciones de longitud y no nulidad. Las categorías equivalentes se canonicalizan, no se rechazan. |
| RN-03 — Precio válido, no negativo y con hasta dos decimales | `products.service` | Frontend ayuda con el formato; SQLite garantiza `price_cents >= 0`. |
| RN-04 — Stock entero y no negativo | `products.service` | Frontend valida el formulario; SQLite garantiza `stock >= 0`. |
| RN-05 — El stock se modifica desde el formulario de edición | `products.service`, con lista explícita de campos editables | Repository actualiza nombre, descripción, categoría, precio y stock validado en una única operación. |
| RN-06 — Aumento del stock | `products.service` coordina la operación | Repository ejecuta una actualización atómica y parametrizada. |
| RN-07 — Disminución del stock sin quedar negativo | `products.service` valida la cantidad y comunica el resultado | Repository ejecuta una actualización condicional que solo resta si hay stock suficiente. |
| RN-08 — Stock bajo si `stock <= 5` | Constante única en el dominio/service | API expone el indicador calculado; interfaz lo presenta sin redefinir el umbral. |
| RN-09 — Contar productos registrados | `summary.service` | Repository calcula `COUNT(*)`. |
| RN-10 — Sumar unidades en stock | `summary.service` | Repository calcula `COALESCE(SUM(stock), 0)`. |
| RN-11 — Contar productos con stock bajo | `summary.service` y umbral común | Repository cuenta los registros con stock menor o igual al umbral. |
| RN-12 — Búsqueda parcial por nombre, sin distinguir mayúsculas | `products.service` normaliza el término | Repository realiza una consulta parametrizada con coincidencia parcial. |
| RN-13 — Filtro por categoría completa normalizada | `products.service` normaliza el filtro | Repository compara categoría ignorando mayúsculas, tildes y espacios repetidos. |
| RN-14 — Combinar búsqueda y categoría | `products.service` pasa ambos filtros | Repository los combina con `AND`; si falta uno, no restringe por ese criterio. |
| RN-15 — Orden alfabético ascendente | Repository | SQL ordena por nombre ascendente. |
| RN-16 — Confirmación y eliminación | Frontend confirma; service/controller ejecutan la operación y detectan inexistencia | Repository elimina solo el identificador solicitado; cancelar no envía la petición. |
| RN-17 — Persistencia tras reiniciar | Módulo de base de datos y repository | Archivo SQLite persistente; pruebas verifican el reinicio del servidor. |
| RN-18 — Validación autoritativa y rechazo íntegro | `products.service` y `summary.service` cuando corresponda | Restricciones SQL, operaciones atómicas y respuestas de error consistentes; una petición inválida no debe producir cambios parciales. |

La lógica de presentación —por ejemplo, mostrar una etiqueta visual de “Stock bajo”— puede estar en el frontend, pero la condición que determina si un producto está bajo de stock debe calcularse a partir del umbral definido en un único lugar del backend.

## 6. ¿Cuáles son las partes difíciles y cómo se resuelven?

Aunque el alcance es pequeño, estas áreas necesitan una implementación cuidadosa.

### 6.1 Evitar errores de precisión en los precios

No se debe usar un valor de punto flotante como almacenamiento o transporte monetario definitivo. El contrato de la API recibe `price` como texto decimal y devuelve el mismo campo como texto con dos cifras. El backend validará y convertirá el valor a centavos enteros para persistir `price_cents`, rechazando precios negativos, mal formados, con más de dos decimales o cuyo valor en centavos exceda `Number.MAX_SAFE_INTEGER`. No se redondean importes silenciosamente.

### 6.2 Evitar que el stock quede negativo

La validación del service explica al usuario por qué una disminución no es válida, pero el repository también debe proteger la integridad de la operación. Para disminuir, la actualización SQL se condicionará a que `stock >= quantity`; la operación se ejecutará de manera atómica. Si no se actualiza ninguna fila, el service distinguirá entre un producto inexistente y un stock insuficiente. No se hará primero una lectura y luego una escritura sin protección, porque esa secuencia podría permitir un resultado inconsistente ante solicitudes muy cercanas.

### 6.3 Mantener sincronizados los datos y los indicadores

La interfaz actualizará el listado y el resumen después de que el backend confirme una operación exitosa. No modificará la interfaz como si el cambio ya se hubiera guardado. Si falla la API, mostrará un error y conservará una representación coherente de los datos recibidos previamente.

### 6.4 Validar datos tanto en la interfaz como en el servidor

La validación del navegador sirve para orientar al usuario; no es una garantía. El service volverá a validar todas las entradas recibidas por HTTP. Las restricciones de SQLite actuarán como protección adicional de integridad.

### 6.5 Manejar errores sin ocultarlos

El backend tendrá un manejo centralizado de errores de Express. Los errores esperables —datos inválidos, producto inexistente o stock insuficiente— se transformarán en respuestas controladas. Los fallos inesperados se registrarán de manera apropiada y devolverán un mensaje genérico; no se enviarán al navegador trazas, consultas SQL ni rutas internas.

### 6.6 Mantener búsquedas seguras y correctas

Los filtros se construyen con consultas parametrizadas. La búsqueda por nombre será parcial, el filtro de categoría será exacto y ambos se combinarán con `AND`. El orden por nombre se resolverá en SQL. No se agregará paginación ni optimización prematura porque no son necesarias para el alcance actual.

### 6.7 Concurrencia, tiempo y correo electrónico

- **Concurrencia:** el MVP contempla un único operador y un uso local/controlado; no necesita colas ni una arquitectura distribuida. Aun así, los ajustes del stock se implementarán como operaciones atómicas para tolerar solicitudes repetidas o muy cercanas. Si en el futuro se habilitan varios operadores, deberá revisarse el diseño.
- **Tiempo:** no existen reglas de negocio dependientes de horarios, vencimientos o zonas horarias. Solo se guardan `created_at` y `updated_at`, con valores generados por el servidor en UTC.
- **Correo electrónico:** no se envían correos ni notificaciones en el MVP; no se añadirá integración de email.

## 7. ¿Qué dudas quedan para el analista?

La especificación define las reglas de negocio necesarias para el MVP. No se identifican dudas funcionales que impidan comenzar el diseño. Sí quedan algunos detalles técnicos que el plan propone resolver de forma explícita antes de terminar la API.

| Tema | Lo que la especificación aún no fija | Propuesta del plan | ¿Bloquea el MVP? |
|---|---|---|---|
| Representación y límite técnico del precio | La conversión de texto JSON numérico a `Number` puede perder centavos antes de validar. | D-015 define `price` como texto decimal en solicitudes y respuestas, con máximo técnico `price_cents = Number.MAX_SAFE_INTEGER`. | No; decisión adoptada y documentada en `decisiones.md`. |
| Formato de errores | El formato que no estaba fijado inicialmente quedó definido en D-016. | Aplicar el formato común descrito en la sección 4.1, con `code`, `message` y `fields` opcional. | Resuelto: D-016 adoptada. |
| `lowStock` en la respuesta | La especificación no requiere una propiedad calculada en el DTO de producto. | No incluir `lowStock` hasta que una decisión expresa lo requiera. | Resuelto: D-016 excluye la propiedad por ahora. |
| Límite numérico de stock | Se exige entero no negativo, pero no se define un máximo funcional. | Rechazar cantidades que no puedan representarse de forma segura en JavaScript y SQLite; no añadir un máximo comercial arbitrario. | No para uso normal; documentar el límite técnico y probar el rechazo de valores fuera de rango. |
| Empate al ordenar nombres idénticos | Se establece orden alfabético por nombre, sin orden secundario. | Usar `id ASC` como segundo criterio para obtener resultados estables cuando los nombres sean iguales. | No; no cambia ninguna regla de negocio. |

Estas propuestas son detalles técnicos del contrato, no nuevas funciones de negocio. Las decisiones adoptadas se registran en `decisiones.md`; cualquier cambio que afecte el comportamiento observable también debe actualizar `spec.md` antes de implementarse.

## 8. Secuencia de implementación

1. **Preparación:** confirmar este plan y resolver o aceptar las propuestas técnicas de la sección 7.
2. **Base de datos:** crear la inicialización de SQLite, el esquema y las restricciones; comprobar persistencia.
3. **Backend:** implementar primero repository, después services, controllers y rutas; cubrir las reglas y casos límite con pruebas.
4. **API:** verificar manualmente y mediante pruebas los códigos HTTP, filtros, ajustes de stock, validaciones y resumen.
5. **Frontend:** construir la tabla y formularios con HTML/CSS/JavaScript; centralizar las solicitudes HTTP en `api.js`.
6. **Integración:** comprobar estados vacío, carga, éxito y error; asegurar que listado e indicadores se actualicen después de cada operación exitosa.
7. **Cierre:** ejecutar pruebas, revisar seguridad básica y documentar comandos reales en `README.md`.

No se debe empezar por generar toda la aplicación en un único prompt. Cada etapa se implementará y verificará contra los criterios de aceptación de `spec.md` antes de avanzar.

## Documentos relacionados

- [`spec.md`](spec.md): contrato funcional y criterios de aceptación.
- [`decisiones.md`](decisiones.md): decisiones adoptadas de producto y tecnología.
- [`preguntas-abiertas.md`](preguntas-abiertas.md): decisiones de alcance futuro ya cerradas para el MVP.
- [`glosario.md`](glosario.md): términos del dominio.
- [`../AGENTS.md`](../AGENTS.md): instrucciones generales para los agentes.
- [`../rules/arquitectura.mdc`](../rules/arquitectura.mdc): reglas del agente arquitecto.

## Historial de cambios

- [cambio] 2026-10-28 — Se crea el plan técnico previo a la implementación: capas, persistencia, modelo de datos, API, ubicación de reglas, riesgos y dudas técnicas.
- [cambio] 2026-10-28 — Se actualiza el transporte de `price` a texto decimal exacto y se documenta el límite técnico de centavos seguros según D-015.
- [cambio] 2026-10-28 — Se alinea el DTO y el formato de errores de API con la decisión adoptada D-016.
- [cambio] 2026-11-15 — Se incorpora la migración transaccional del estado de presupuesto heredado al estado vigente `issued`.


## 9. Estado implementado y reglas incorporadas después del plan inicial

Esta sección prevalece sobre cualquier frase histórica del documento que describa el proyecto como una propuesta previa a la implementación. El sistema implementado incluye catálogo de productos, stock, resumen, presupuestos, reservas transaccionales, PDF e historial de resolución.

### 9.1 Reglas adicionales de presupuestos

- Un presupuesto contiene entre 1 y 50 líneas de productos distintos. La cantidad por línea es un entero seguro mayor que cero.
- La creación se ejecuta en una transacción `BEGIN IMMEDIATE`: valida existencia y stock, captura nombre y precio unitario, descuenta stock, guarda líneas y total, y confirma todo junto. Si cualquier línea falla, se revierte la operación completa.
- El importe de cada línea y el total se calculan con `BigInt` y deben caber en `Number.MAX_SAFE_INTEGER` centavos.
- El presupuesto nace `issued` (emitido). Los estados válidos son `issued`, `paid` y `rejected`; la interfaz muestra **Emitido**, **Pagado** o **Rechazado**. Solo puede resolverse una vez como `paid` o `rejected`. `paid` mantiene el stock reservado; `rejected` devuelve exactamente las cantidades capturadas, dentro de una transacción.
- Al abrir una base SQLite anterior, la inicialización migra `pending` a `issued` mediante reconstrucción transaccional de `budgets`, preservando los IDs, los datos históricos, las líneas y las relaciones de clave foránea.
- Los productos asociados a presupuestos emitidos no pueden eliminarse. El detalle histórico no depende del nombre ni precio actual del catálogo.
- El PDF se genera en backend a partir de la fotografía persistida del presupuesto.

### 9.2 Diferencias vigentes respecto del plan inicial

- El stock disponible se edita dentro del formulario de edición del producto. Los endpoints de ajuste relativo se mantienen por compatibilidad y cobertura de API, pero no se exponen como acción separada en la interfaz.
- Las categorías son texto reutilizable normalizado; no existe administración independiente de categorías.
- La aplicación no incluye autenticación. Es de uso local o controlado y no debe exponerse públicamente con datos reales.
- El backend requiere Node.js 22.13.0 o superior y utiliza `node:sqlite`; no necesita un paquete nativo de SQLite.

### 9.3 Criterios técnicos de aceptación implementados

- Todas las entradas se validan en backend; frontend valida solo para mejorar la experiencia.
- Los textos se miden en puntos de código Unicode, coherentes con `length()` de SQLite para los límites definidos.
- Las consultas SQL reciben parámetros; el orden incluye `id ASC` como desempate estable.
- Los cambios de stock y las transiciones de presupuestos se protegen con transacciones y condiciones SQL.
- Las respuestas de API no se cachean y se aplican cabeceras de seguridad básicas.

## 10. Estado de pruebas y cierre

Las tareas del backlog, las suites automatizadas completas de backend y frontend, las verificaciones manuales y el recorrido integral se consideran completados y aprobados según la confirmación del equipo. La suite frontend se ejecuta desde `frontend/` con `npm test`; la suite backend desde `backend/` con `npm test`. El informe `docs/INFORME-VERIFICACION.md` consolida el resultado de aceptación del equipo y las verificaciones técnicas adicionales de esta revisión. No quedan acciones abiertas dentro del alcance del MVP.

- [cambio] 2026-11-15 — Se incorpora bloqueo de acceso HTTP a los archivos fuente de pruebas bajo `/test/`; las pruebas permanecen en el repositorio pero no se sirven como contenido estático.
