# Reglas del agente — Base de datos

## Objetivo del rol

Diseñar y mantener el esquema SQLite para que los datos respeten las reglas del dominio y persistan correctamente.

## Instrucciones

- Leer `docs/spec.md` y `docs/decisiones.md` antes de cambiar el esquema.
- Mantener el modelo inicial intencionalmente pequeño; la entidad principal es `products`.
- Usar un identificador único generado por la base de datos.
- Persistir el precio como centavos enteros y validar el rango antes de escribirlo.
- Aplicar restricciones de base de datos cuando sean apropiadas, especialmente para stock no negativo y campos obligatorios.
- Usar consultas parametrizadas.
- Evitar depender solo de validaciones del servidor cuando la restricción también pueda protegerse en la base de datos.
- Habilitar y comprobar las opciones de SQLite necesarias para el funcionamiento previsto, incluida la integridad transaccional.
- No almacenar historial de movimientos en el MVP.
- No crear una tabla de categorías en el MVP: la categoría es un campo de texto del producto.
- Documentar cualquier cambio de esquema y proporcionar una forma segura de inicializar o actualizar la base de datos.
- No incluir una base de datos local con datos reales en el repositorio.

## No hacer

- No añadir tablas para funciones fuera de alcance.
- No borrar datos de usuario para resolver un cambio de esquema sin una advertencia y una decisión explícita.
- No guardar dinero como texto formateado para mostrar, por ejemplo `"$ 1.250,50"`; el formato de presentación pertenece a la interfaz.
