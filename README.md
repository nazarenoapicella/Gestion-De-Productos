# Stock Simple

Aplicación web para gestionar un catálogo de productos, el stock disponible, el resumen del inventario y el ciclo de presupuestos con reserva de stock.

> **Estado: COMPLETADO.** El equipo confirma la aprobación de las suites automatizadas completas de backend y frontend, los escenarios manuales, el flujo integral de presupuestos y la ejecución desde un clon limpio. La verificación técnica adicional y el cierre se detallan en [`docs/INFORME-VERIFICACION.md`](docs/INFORME-VERIFICACION.md).

## Demo en línea

**Aplicación publicada:** https://gestion-de-productos-k96u.onrender.com/

La arquitectura de la demo utiliza un único servicio que sirve API e interfaz desde el mismo origen. El frontend utiliza rutas relativas `/api`, por lo que no requiere configuración CORS. Si se separaran los servicios, el backend tendría que permitir exclusivamente el origen exacto del frontend, sin `*`.

- Si nadie la usó en los últimos 15 minutos, el primer acceso puede demorar alrededor de un minuto mientras el servicio se reactiva.
- La base SQLite vive en el disco temporal del servicio: productos y presupuestos cargados se pierden cuando el servicio se reinicia o se vuelve a desplegar.
- Variables de entorno configuradas en el panel de Render (no están en el repositorio): `NODE_VERSION=22`, `HOST=0.0.0.0`.
- La demo no tiene autenticación: cualquiera que conozca la dirección puede ver y modificar los datos. La publicación es únicamente para evaluación académica; no debe cargarse información real.

**Recorrido sugerido para probarla:** crear un producto con stock, editarlo para cambiar su stock, entrar en **Presupuestos**, generar un presupuesto (se descarga el PDF y el stock se descuenta) y marcarlo como **Rechazado** para ver que el stock reservado se devuelve.

## Objetivo de la primera versión

La versión inicial permite:

- listar productos registrados;
- registrar un producto nuevo;
- editar nombre, descripción, categoría y precio;
- eliminar un producto con confirmación;
- buscar y filtrar por categoría;
- actualizar el stock disponible dentro del formulario de edición (la API conserva endpoints de ajuste relativo por compatibilidad);
- consultar el resumen del inventario;
- preparar presupuestos seleccionando productos y cantidades;
- reservar stock al emitir un presupuesto y generar un PDF descargable;
- marcar presupuestos emitidos como pagados o rechazados;
- devolver automáticamente el stock reservado cuando un presupuesto se rechaza y conservar un historial de todos los presupuestos.

El alcance contractual se encuentra en [`docs/spec.md`](docs/spec.md), con decisiones relevantes en [`docs/decisiones.md`](docs/decisiones.md) y el plan técnico en [`docs/plan.md`](docs/plan.md).

## Tecnologías

- Frontend: HTML, CSS y JavaScript sin framework.
- Backend: Node.js y Express.
- Persistencia: SQLite.
- Comunicación: API REST bajo `/api`.
- Pruebas: Node.js `node:test` para backend y frontend.

## Estructura del repositorio

```text
stock-simple/
├── README.md
├── AGENTS.md
├── .gitignore
├── docs/
│   ├── decisiones.md
│   ├── glosario.md
│   ├── idea.md
│   ├── plan.md
│   ├── preguntas-abiertas.md
│   ├── spec.md
│   ├── tasks.md
│   ├── pruebas-manuales.md
│   └── INFORME-VERIFICACION.md
├── rules/
│   ├── analista-funcional.mdc
│   ├── arquitectura.mdc
│   ├── backend.mdc
│   ├── base-de-datos.mdc
│   ├── documentacion.mdc
│   ├── frontend.mdc
│   ├── testing-qa.mdc
│   └── revisor.mdc
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   │   ├── app.js
│   │   ├── db/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── utils/          # Generación del PDF de presupuestos
│   │   └── server.js
│   └── test/
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── css/
│   ├── js/
│   ├── index.html
│   └── test/
└── backend/
    └── data/
```

## Requisitos

- Node.js 22.13.0 o superior.
- npm.
- Acceso local o dentro de un entorno controlado.

## Instalación y configuración

Desde la raíz del proyecto:

```bash
cd backend
npm install
cp .env.example .env
```

El servidor carga automáticamente `backend/.env` con las opciones nativas de Node.js. Podés editar `PORT`, `HOST` y `DATABASE_PATH` según tu entorno. No subas el archivo `.env` a Git.

## Inicialización de la base de datos

Este comando crea la base SQLite en `backend/data/stock-simple.sqlite` si no existe:

```bash
cd backend
npm run db:init
```

## Ejecutar la aplicación

Se sirve la interfaz y la API desde el mismo origen en `http://localhost:3000`:

```bash
cd backend
npm start
```

Luego abrí la URL en el navegador:

```text
http://localhost:3000
```

## Probar el backend

```bash
cd backend
npm test
```

## Probar frontend y suite completa

Desde la raíz del repositorio, para ejecutar las pruebas de frontend:

```bash
cd frontend
npm ci
npm test
```

Para ejecutar las suites desde el backend:

```bash
cd backend
npm ci
npm run test:all
```

## Verificar la suma de stock y el resumen

Con la aplicación levantada, puedes realizar una comprobación rápida de la API:

```bash
curl http://localhost:3000/api/products
curl http://localhost:3000/api/summary
```

O crear un producto de prueba:

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Mouse","category":"Periféricos","price":"1250.50","stock":5,"description":""}'
```

## Presupuestos y reservas de stock

1. Entrá en el apartado **Presupuestos**.
2. Seleccioná un producto, indicá una cantidad entera positiva y agregalo al detalle. La cantidad no puede superar el stock disponible.
3. Repetí el proceso con los productos necesarios. El sistema calcula el subtotal de cada línea y el total general.
4. Al presionar **Generar presupuesto y PDF**, el servidor valida nuevamente los productos, precios y existencias, descuenta el stock y guarda una fotografía del nombre y precio de cada producto en una única transacción. El PDF se descarga automáticamente.
5. Mientras no se resuelva, el presupuesto conserva el estado técnico `issued` y aparece en **Presupuestos emitidos**, donde permite descargar de nuevo el PDF.
6. Al marcarlo como **Pagado**, sale de emitidos y pasa al historial. El stock permanece descontado.
7. Al marcarlo como **Rechazado**, sale de emitidos, pasa al historial y el stock reservado se devuelve una sola vez.

Los presupuestos resueltos no se eliminan: permanecen en el historial. Los productos que tienen unidades reservadas en un presupuesto emitido no se pueden eliminar hasta que ese presupuesto se resuelva. Las modificaciones posteriores del nombre o precio del producto no alteran el presupuesto ya emitido ni su PDF.

La API incorpora estos endpoints adicionales:

| Método y ruta | Propósito |
|---|---|
| `POST /api/budgets` | Crear presupuesto y reservar stock. Recibe `items: [{ productId, quantity }]`. |
| `GET /api/budgets` | Listar presupuestos emitidos y resueltos. |
| `GET /api/budgets/:id` | Consultar un presupuesto y sus líneas. |
| `GET /api/budgets/:id/pdf` | Descargar el PDF del presupuesto. |
| `PATCH /api/budgets/:id/status` | Resolver un presupuesto con `status: "paid"` o `status: "rejected"`. |

Las tablas `budgets` y `budget_items` se crean automáticamente al abrir SQLite. Si se utiliza una base existente de una versión anterior, la inicialización migra el estado técnico legado `pending` a `issued` y conserva los presupuestos, sus líneas y sus relaciones. Los estados actuales son `issued`, `paid` y `rejected`; en la interfaz se muestran como **Emitido**, **Pagado** y **Rechazado**. Los precios y subtotales se almacenan en centavos enteros para evitar errores de redondeo.

## Uso y límite de seguridad

La primera versión no incluye autenticación ni control de usuarios. Está pensada para uso local o en un entorno controlado. La demo pública descripta arriba se publica solo con fines de evaluación académica, con datos de prueba; antes de usarla con datos reales hay que implementar autenticación, autorización y medidas de seguridad apropiadas.

## Verificación de persistencia

Para comprobar que los cambios persisten tras reiniciar el servidor:

1. levantá la aplicación con `npm start`;
2. creá un producto con stock `5` desde la interfaz o por la API;
3. detené el proceso;
4. volvé a levantar la aplicación;
5. consultá el producto y verificá que sigue con el mismo stock.

## Documentación del proyecto

- [`docs/idea.md`](docs/idea.md): problema y objetivo.
- [`docs/decisiones.md`](docs/decisiones.md): decisiones vigentes.
- [`docs/glosario.md`](docs/glosario.md): términos del dominio.
- [`docs/preguntas-abiertas.md`](docs/preguntas-abiertas.md): decisiones de alcance futuro, cerradas para este MVP.
- [`docs/spec.md`](docs/spec.md): 22 reglas de negocio, 9 historias y casos límite.
- [`docs/plan.md`](docs/plan.md): arquitectura implementada, modelo de datos y API.
- [`docs/tasks.md`](docs/tasks.md): backlog cerrado.
- [`docs/INFORME-VERIFICACION.md`](docs/INFORME-VERIFICACION.md): resultados de aceptación, verificaciones técnicas adicionales y cierre del MVP.

## Historial de cambios

- [cambio] 2026-10-22 — Se crea la documentación inicial y se define el alcance provisional de la primera versión.
- [cambio] 2026-10-28 — Se documentan los comandos reales de instalación, inicialización, ejecución y pruebas del MVP.
- [cambio] 2026-10-28 — Se precisa que la versión actual es de uso local/controlado y sin autenticación.
- [cambio] 2026-11-02 — Se documentan la configuración `.env`, las reglas de stock y categorías, y la suite completa de pruebas.
- [cambio] 2026-11-02 — Se incorpora el flujo de presupuestos con reserva transaccional de stock, PDF e historial de pagados/rechazados.
- [cambio] 2026-11-15 — Se agrega la sección de demo en línea y se actualiza el límite de seguridad para el despliegue de evaluación (Render, plan gratuito).
- [cambio] 2026-11-15 — Se sincroniza la documentación con el flujo de presupuestos y se normalizan los nombres de archivos de agentes y backlog.
