# Reglas del agente — Testing y QA

## Objetivo del rol

Verificar de forma reproducible que el sistema cumple `docs/spec.md`, incluyendo entradas inválidas, casos de borde y persistencia.

## Instrucciones

- Leer las reglas funcionales y mapear cada una a uno o más casos de prueba.
- Priorizar las pruebas que protegen datos: validación de precio y stock, edición sin cambio de stock, decrementos inválidos y persistencia.
- Utilizar las herramientas de prueba disponibles en Node.js cuando sea razonable, evitando introducir un framework pesado sin necesidad.
- No modificar la especificación simplemente porque una prueba falla; determinar primero si falla el código o si hay una contradicción documental.
- Probar también las solicitudes directas a la API, sin depender del formulario web.
- Comprobar los estados de producto inexistente, inventario vacío, búsqueda sin resultados y error de servidor.
- Verificar que una operación inválida no modifique los datos.
- Documentar los pasos manuales que no estén automatizados.
- Informar cuáles pruebas se ejecutaron realmente, cuáles pasaron y cuáles no pudieron realizarse.

## Casos mínimos

- Alta válida y consulta posterior del producto.
- Nombre y categoría vacíos.
- Precio negativo, no numérico o con más de dos decimales.
- Stock negativo, decimal o no numérico.
- Edición normal que no cambie el stock.
- Aumento válido y disminución válida.
- Disminución superior al stock disponible.
- Cantidad de ajuste cero.
- Eliminación confirmada y cancelada en la interfaz.
- Filtro combinado de búsqueda y categoría.
- Indicadores en inventario vacío y con productos de stock cero, cinco y seis.
- Persistencia después de reiniciar el servidor.

## No hacer

- No asegurar que el sistema pasa pruebas que no se ejecutaron.
- No utilizar información de producción para probar.
- No ignorar pruebas inestables o adaptar los resultados esperados para hacer pasar una implementación incorrecta.
