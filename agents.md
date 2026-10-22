# Instrucciones generales para agentes de IA

Este archivo contiene las reglas comunes para cualquier agente que trabaje en Stock Simple. Antes de modificar el proyecto, el agente debe leer este archivo y la regla específica de su rol dentro de `rules/`.

## 1. Fuente de verdad

Consultar los documentos en este orden:

1. `docs/spec.md`: comportamiento acordado para la primera versión.
2. `docs/decisiones.md`: decisiones de producto y técnicas ya tomadas.
3. `docs/preguntas-abiertas.md`: asuntos que no bloquean el MVP y que quedan para una decisión futura.
4. `docs/ideas.md`: intención original y contexto del proyecto.
5. `docs/glosario.md`: significado de términos del dominio.

Si dos documentos se contradicen, no elegir silenciosamente una versión. Identificar la contradicción, explicar qué partes afecta y proponer la corrección documental más pequeña. La especificación no debe cambiar solo para acomodarse a una implementación que se desvió de lo acordado.

## 2. Principios no negociables

- Mantener el sistema simple, legible y fácil de modificar.
- Implementar únicamente el alcance descrito en `docs/spec.md`, salvo autorización explícita para ampliarlo.
- No inventar flujos, roles, reglas, estados, campos ni excepciones de negocio.
- Ante una ambigüedad que afecte al comportamiento, consultar las decisiones y preguntas abiertas. Si sigue sin resolverse, señalarla y proponer una alternativa; no presentarla como aprobada.
- No cambiar una decisión existente sin indicar el impacto y actualizar `docs/decisiones.md` y los demás documentos afectados.
- Preferir soluciones directas y convencionales antes que abstracciones, patrones o dependencias innecesarias.
- No afirmar que una función, prueba, comando o integración funciona si no se ejecutó y verificó.
- No borrar trabajo del usuario ni reescribir archivos no relacionados con la tarea.

## 3. Reglas técnicas generales

- Usar JavaScript para frontend y backend, HTML semántico y CSS estándar.
- Mantener una separación clara entre interfaz, API, lógica de negocio y acceso a datos sin crear capas vacías o innecesarias.
- La API es la única vía de acceso del frontend a los datos persistentes.
- Validar y normalizar las entradas en el servidor. La validación del navegador es complementaria, no una medida de seguridad.
- Utilizar consultas SQL parametrizadas; nunca concatenar entradas del usuario para construir consultas SQL.
- No insertar texto introducido por el usuario en el DOM como HTML sin sanitización. Preferir APIs seguras como `textContent`.
- Mantener mensajes de error comprensibles para el usuario y evitar exponer trazas, consultas SQL o detalles internos.
- No incluir credenciales ni secretos en el repositorio. Usar variables de entorno documentadas en archivos de ejemplo.
- No añadir autenticación, ventas, compras, proveedores, facturación, permisos o servicios externos al MVP sin una decisión expresa.

## 4. Cómo trabajar

Antes de actuar:

1. Identificar el objetivo y el rol solicitado.
2. Leer la especificación y la regla del rol.
3. Enumerar los archivos que probablemente deban cambiar.
4. Comprobar si existe una decisión pendiente que afecte a la tarea.

Durante el trabajo:

- Hacer cambios pequeños y coherentes.
- Seguir las convenciones existentes en lugar de introducir una segunda forma de resolver lo mismo.
- Tratar correctamente los casos límite definidos en la especificación.
- No ocultar errores con valores predeterminados silenciosos.

Al terminar:

- Ejecutar las pruebas pertinentes y revisar el resultado real.
- Resumir los archivos cambiados y el motivo.
- Indicar las pruebas ejecutadas y las que no pudieron ejecutarse.
- Actualizar la documentación y el historial `[cambio]` cuando se modifique el alcance, una decisión o el funcionamiento observable.
- Señalar cualquier duda o riesgo que siga abierto.

## 5. Coordinación entre roles

- El **analista funcional** mantiene la coherencia entre necesidad, decisiones, preguntas y especificación.
- El **arquitecto** propone la estructura técnica mínima necesaria.
- El **agente de backend** implementa la API y las reglas de negocio del servidor.
- El **agente de base de datos** cuida el esquema, las restricciones y la persistencia.
- El **agente de frontend** implementa la interfaz y la comunicación con la API.
- El **agente de QA** verifica los criterios de aceptación y los casos límite.
- El **agente de documentación** mantiene documentos claros y sincronizados con el sistema real.

Si un agente detecta que necesita cambiar el contrato de la API o una regla de negocio para completar su tarea, debe informarlo y proponer el cambio antes de implementarlo.

## Historial de cambios

- [cambio] 2026-10-22 — Se establecen instrucciones generales, fuentes de verdad y responsabilidades de los agentes.
