# Glosario

Los siguientes términos tienen un significado concreto dentro de Stock Simple. Si un término empieza a usarse con otro sentido, se debe aclarar antes de modificar la especificación.

| Término | Significado en este proyecto |
|---|---|
| **Producto** | Un registro del catálogo con nombre, descripción opcional, categoría, precio y cantidad actual de stock. Tener dos productos con el mismo nombre no queda prohibido por el MVP; cada registro tiene su propio identificador. |
| **Inventario** | Conjunto de productos registrados y sus cantidades actuales en stock. |
| **Stock** | Cantidad entera de unidades disponibles de un producto. Puede ser cero, pero nunca negativa. |
| **Stock inicial** | Cantidad que se indica al crear un producto. Después de la creación, los cambios se hacen mediante la función de ajuste de stock. |
| **Ajuste de stock** | Operación explícita para aumentar o disminuir la cantidad actual de un producto. En el MVP no genera un historial de movimientos. |
| **Stock bajo** | Estado de un producto cuya cantidad actual es menor o igual que cinco unidades. Incluye los productos sin unidades disponibles. |
| **Producto sin stock** | Producto cuya cantidad actual es exactamente cero. También se considera de stock bajo. |
| **Categoría** | Texto obligatorio que se utiliza para clasificar y filtrar productos. No es una entidad administrable independiente en el MVP. |
| **Productos registrados** | Número de registros de producto existentes, independientemente de cuántas unidades tenga cada uno. |
| **Unidades en stock** | Suma de las cantidades actuales de todos los productos. No representa la cantidad de productos diferentes. |
| **CRUD** | Operaciones de crear, leer, actualizar y eliminar información. |
| **Frontend** | Parte de la aplicación que se ejecuta en el navegador y presenta la interfaz al usuario. |
| **Backend** | Parte del sistema que recibe peticiones, aplica validaciones y reglas de negocio, y consulta la base de datos. |
| **API** | Interfaz por la que el frontend solicita al backend operaciones sobre los datos. En el MVP intercambia JSON por HTTP. |
| **Persistencia** | Conservación de la información en la base de datos para que sobreviva al cierre o reinicio de la aplicación. |
| **MVP** | Versión mínima que resuelve el problema principal con un conjunto controlado de funcionalidades. |
| **Caso límite** | Situación de borde que debe tener un comportamiento definido, por ejemplo intentar retirar más unidades de las disponibles. |
| **Regla de negocio** | Condición que define qué operaciones son válidas y cómo debe comportarse el sistema desde el punto de vista del comercio. |
| **Criterio de aceptación** | Condición observable que debe cumplirse para considerar que una función está implementada correctamente. |
| **ARS** | Código de moneda del peso argentino, utilizado para expresar los precios. |

## Historial de cambios

- [cambio] 2026-10-22 — Se definen los términos centrales para evitar interpretaciones diferentes durante el análisis y la implementación.
