# Ideas del proyecto

[estado: idea inicial ordenada]

## Contexto

Quiero construir como proyecto propio una aplicación web completa para gestionar los productos y el inventario de un comercio pequeño. La intención es aplicar lo aprendido durante el curso y practicar el desarrollo de un sistema real: interfaz, backend, API y base de datos.

El reto principal no es pedirle a una IA que genere pantallas o código rápidamente, sino definir con precisión qué debe hacer el sistema, cuáles son sus reglas y qué debe ocurrir en situaciones límite. La documentación debe permitir que una persona —o un agente de IA— implemente el comportamiento esperado sin tener que inventar reglas por su cuenta.

## Necesidad que se quiere resolver

Un comercio pequeño necesita una forma sencilla de mantener una lista actualizada de los productos que tiene disponibles, consultar sus precios y categorías, corregir sus datos y controlar las cantidades en stock.

La primera versión no pretende administrar todo el negocio. Su objetivo es resolver de forma clara la gestión básica del catálogo y las cantidades disponibles.

## Funcionalidades que imagino

- Ver una lista de los productos registrados.
- Registrar un producto indicando nombre, precio, categoría y stock inicial.
- Agregar una descripción opcional al producto.
- Modificar los datos de un producto existente.
- Eliminar un producto mediante una confirmación.
- Buscar productos por nombre.
- Filtrar productos por categoría.
- Aumentar o disminuir el stock, sin permitir cantidades negativas.
- Consultar cuántos productos están registrados, cuántas unidades hay en stock y cuáles necesitan reposición.

## Usuario previsto

Para la primera versión, pienso en una sola persona que administra el inventario de un único comercio. No se contempla que varios comercios compartan el sistema ni que distintos empleados tengan permisos diferentes.

## Qué considero importante

- Que las reglas sean simples, explícitas y coherentes.
- Que los datos continúen guardados después de cerrar o reiniciar la aplicación.
- Que las operaciones sean fáciles de entender y no permitan dejar el inventario en un estado inválido.
- Que el proyecto tenga una estructura clara y pueda ampliarse sin rehacerlo todo.
- Que la interfaz avise cuando una operación no se pueda completar.
- Que la aplicación sea realmente de punta a punta; no una maqueta que solo funcione en el navegador.

## Límites iniciales que propongo

No incluir inicialmente ventas, compras a proveedores, pedidos, pagos, facturas, códigos de barras, autenticación, múltiples sucursales ni reportes complejos. Esas funciones aumentarían la cantidad de reglas y quedan fuera de la primera versión.

## Nota para el análisis funcional

Este archivo expresa la intención inicial y no reemplaza el contrato. Si una necesidad admite varias interpretaciones, debe resolverse mediante una decisión documentada o quedar señalada como pregunta abierta antes de modificar la especificación.

## Historial de cambios

- [cambio] 2026-10-22 — Se organiza la idea del proyecto a partir de los requisitos iniciales.
