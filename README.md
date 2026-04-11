# registro

Aplicación web simple (HTML/CSS/JS) para planificación académica basada en los requerimientos de pizarra:

- Registrar **periodo** (nombre, fechas y año).
- Registrar **turno** (minutos por bloque, créditos por bloque, horario, almuerzo y días hábiles con periodos).
- Registrar **docentes** por especialidad.
- Registrar **aulas** por tipo (Lab, Taller, Aula).
- Cargar **clases por CSV** con formato: `nombre,especialidad,tipo,credito`.
- Asignar docente y aula a cada clase importada.
- Generar horario automático por turno evitando conflicto de docente en el mismo bloque.

## Uso

1. Abrir `index.html` en un navegador.
2. Completar formularios en orden (periodo, turno, docente, aula).
3. Pegar CSV de clases y pulsar **Importar clases**.
4. En la tabla final, seleccionar docente y aula para cada clase.
5. En "Generar horario", seleccionar turno y pulsar **Generar horario**.

> La información se guarda en `localStorage` del navegador.
