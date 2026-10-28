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
- consultar el resumen del inventario.

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

## Instalación

Desde la raíz del proyecto:

```bash
cd backend
npm install
```

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

Luego abre la URL en el navegador:

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
