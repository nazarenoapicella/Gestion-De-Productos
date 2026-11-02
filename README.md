# Stock Simple

Aplicación web local para gestionar un catálogo de productos, el stock disponible y el resumen del inventario.

## Objetivo de la primera versión

La versión inicial permite:

- listar productos registrados;
- registrar un producto nuevo;
- editar nombre, descripción, categoría y precio;
- eliminar un producto con confirmación;
- buscar y filtrar por categoría;
- aumentar o disminuir stock con una operación explícita;
- consultar el resumen del inventario;
- preparar presupuestos seleccionando productos y cantidades;
- reservar stock al emitir un presupuesto y generar un PDF descargable;
- marcar presupuestos pendientes como pagados o rechazados;
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
├── agents.md
├── .gitignore
├── docs/
│   ├── decisiones.md
│   ├── glosario.md
│   ├── ideas.md
│   ├── plan.md
│   ├── preguntas-abiertas.md
│   ├── spec.md
│   └── task.md
├── rules/
│   ├── analista-funcional.mdc
│   ├── arquitectura.mdc
│   ├── backend.mdc
│   ├── base-de-datos.mdc
│   ├── documentacion.mdc
│   ├── frontend.mdc
│   └── testing-qa.mdc
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

```bash
cd backend
npm run test:frontend
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
5. Mientras esté pendiente, el presupuesto aparece en **Presupuestos pendientes** y permite descargar de nuevo el PDF.
6. Al marcarlo como **Pagado**, sale de pendientes y pasa al historial. El stock permanece descontado.
7. Al marcarlo como **Rechazado**, sale de pendientes, pasa al historial y el stock reservado se devuelve una sola vez.

Los presupuestos resueltos no se eliminan: permanecen en el historial. Los productos que tienen unidades reservadas en un presupuesto pendiente no se pueden eliminar hasta que ese presupuesto se resuelva. Las modificaciones posteriores del nombre o precio del producto no alteran el presupuesto ya emitido ni su PDF.

La API incorpora estos endpoints adicionales:

| Método y ruta | Propósito |
|---|---|
| `POST /api/budgets` | Crear presupuesto y reservar stock. Recibe `items: [{ productId, quantity }]`. |
| `GET /api/budgets` | Listar presupuestos pendientes y resueltos. |
| `GET /api/budgets/:id` | Consultar un presupuesto y sus líneas. |
| `GET /api/budgets/:id/pdf` | Descargar el PDF del presupuesto. |
| `PATCH /api/budgets/:id/status` | Resolver un presupuesto con `status: "paid"` o `status: "rejected"`. |

Las tablas `budgets` y `budget_items` se crean automáticamente al abrir SQLite, también cuando se utiliza una base de datos existente. Los precios y subtotales se almacenan en centavos enteros para evitar errores de redondeo.

## Uso local y límite de seguridad

La primera versión no incluye autenticación ni control de usuarios. Por eso debe usarse solo en:

- entorno local del equipo;
- entorno controlado del mismo comercio;
- una red privada, no pública ni accesible desde Internet sin un diseño de seguridad adicional.

No publicarla abiertamente ni usarla con datos reales de producción antes de implementar autenticación, autorización y medidas de seguridad apropiadas.

## Verificación de persistencia

Para comprobar que los cambios persisten tras reiniciar el servidor:

1. levantá la aplicación con `npm start`;
2. creá un producto con stock `5` desde la interfaz o por la API;
3. detené el proceso;
4. volvé a levantar la aplicación;
5. consultá el producto y verificá que sigue con el mismo stock.

## Historial de cambios

- [cambio] 2026-10-22 — Se crea la documentación inicial y se define el alcance provisional de la primera versión.
- [cambio] 2026-10-28 — Se documentan los comandos reales de instalación, inicialización, ejecución y pruebas del MVP.
- [cambio] 2026-10-28 — Se precisa que la versión actual es de uso local/controlado y sin autenticación.
- [cambio] 2026-11-02 — Se documentan la configuración `.env`, las reglas de stock y categorías, y la suite completa de pruebas.
- [cambio] 2026-11-02 — Se incorpora el flujo de presupuestos con reserva transaccional de stock, PDF e historial de pagados/rechazados.
