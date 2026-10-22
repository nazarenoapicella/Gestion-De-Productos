# Stock Simple

[estado: documentación inicial — implementación todavía no iniciada]

Aplicación web para gestionar los productos y el stock de un comercio pequeño. El objetivo de este proyecto es construir un sistema funcional de punta a punta con una interfaz web, una API de backend y una base de datos persistente, manteniendo reglas de negocio explícitas y fáciles de verificar.

## Objetivo de la primera versión

La versión inicial permitirá registrar, consultar, buscar, editar y eliminar productos; ajustar sus cantidades de stock; y ver un resumen del inventario y los productos con stock bajo.

El alcance contractual se encuentra en [`docs/spec.md`](docs/spec.md). Antes de cambiar el comportamiento del sistema, hay que revisar también [`docs/decisiones.md`](docs/decisiones.md) y [`docs/preguntas-abiertas.md`](docs/preguntas-abiertas.md).

## Tecnologías previstas

- **Frontend:** HTML, CSS y JavaScript sin framework.
- **Backend:** Node.js y Express.
- **Base de datos:** SQLite.
- **Comunicación:** API REST con JSON, bajo el prefijo `/api`.
- **Pruebas de backend:** módulo de pruebas integrado de Node.js (`node:test`) cuando comience la implementación.

Estas tecnologías son las elegidas para este proyecto inicial. No deben incorporarse frameworks, servicios externos ni dependencias adicionales sin una necesidad concreta y una decisión documentada.

## Estructura del repositorio

```text
stock-simple/
├── README.md
├── agents.md
├── .gitignore
├── docs/
│   ├── ideas.md
│   ├── decisiones.md
│   ├── preguntas-abiertas.md
│   ├── glosario.md
│   └── spec.md
├── rules/
│   ├── analista-funcional.md
│   ├── arquitectura.md
│   ├── backend.md
│   ├── base-de-datos.md
│   ├── frontend.md
│   ├── testing-qa.md
│   └── documentacion.md
├── backend/
│   ├── .env.example
│   └── (código del servidor, cuando se implemente)
└── frontend/
    └── (HTML, CSS y JavaScript de la interfaz, cuando se implemente)
```

## Estado actual

En esta etapa se están definiendo el problema, las reglas de negocio, los límites de la primera versión y los criterios de aceptación. La carpeta `backend/` y la carpeta `frontend/` todavía no contienen una aplicación implementada.

## Criterios de trabajo

1. La especificación de [`docs/spec.md`](docs/spec.md) define el comportamiento esperado de la primera versión.
2. No se deben inventar reglas de negocio ni cambiar decisiones documentadas de manera silenciosa.
3. La validación de los datos debe realizarse en el backend, aunque el frontend también valide para ayudar al usuario.
4. La interfaz no accede directamente a la base de datos: se comunica con el backend mediante la API.
5. Cualquier cambio de alcance debe actualizar la documentación correspondiente antes o junto con el código.
6. No se deben guardar secretos, contraseñas, bases de datos locales ni archivos `.env` reales en Git.

## Puesta en marcha

Todavía no hay código ejecutable, por lo que aún no existen comandos de instalación o inicio. Cuando se implemente la primera versión, esta sección deberá documentar los comandos reales y verificados para instalar dependencias, inicializar la base de datos, ejecutar las pruebas y arrancar el sistema.

## Límite importante

La primera versión se plantea para uso local o en un entorno controlado, con un único operador y sin autenticación. **No debe exponerse a Internet ni utilizarse para gestionar datos reales en producción hasta incorporar y revisar autenticación, autorización y las medidas de seguridad necesarias.**

## Historial de cambios

- [cambio] 2026-10-22 — Se crea la documentación inicial y se define el alcance provisional de la primera versión.
