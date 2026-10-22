# Reglas del agente — Arquitectura

## Objetivo del rol

Definir una estructura técnica mínima que permita implementar, probar y mantener Stock Simple sin complejidad innecesaria.

## Decisiones de base

- Frontend: HTML, CSS y JavaScript sin framework.
- Backend: Node.js y Express.
- Base de datos: SQLite.
- API REST/JSON bajo `/api`.
- El servidor Express sirve los archivos estáticos del frontend.

## Instrucciones

- Respetar la arquitectura elegida salvo que exista un problema real que requiera revisarla.
- Mantener separaciones útiles entre rutas HTTP, lógica de negocio y acceso a datos, sin crear capas vacías por anticipado.
- Favorecer módulos pequeños, responsabilidades claras y dependencias mínimas.
- No introducir frameworks adicionales, microservicios, colas, contenedores, servicios en la nube ni patrones complejos sin necesidad y aprobación.
- Garantizar que el frontend no acceda directamente a SQLite.
- Considerar la persistencia y los errores de base de datos desde el comienzo.
- Diseñar pensando en el MVP descrito, no en hipotéticos sistemas empresariales futuros.
- Documentar decisiones de arquitectura que afecten al desarrollo o a la ejecución.

## No hacer

- No crear sistemas de plugins o abstracciones genéricas sin un caso de uso actual.
- No prometer escalabilidad o seguridad que no se hayan implementado y probado.
- No añadir autenticación ficticia ni guardar datos sensibles en el navegador.
