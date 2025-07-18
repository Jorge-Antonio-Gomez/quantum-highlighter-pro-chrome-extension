# Hoja de Ruta - Mejoras para el Resaltador Web

Este archivo documenta las tareas planificadas para mejorar el script `script_v1_gemini.js`.

## Fase 1: Robustez del Sistema de Anotaciones (Completada)

*   [x] **Tarea 1.1:** Reemplazar el guardado por selector CSS (`getPathTo`) con un método basado en contexto de texto.
*   [x] **Tarea 1.2:** Implementar la lógica `restoreHighlights` para que busque el texto de contexto en la página y reaplique la anotación.
*   [x] **Tarea 1.3:** Manejar selecciones que abarcan múltiples nodos HTML (ej: `un párrafo con <b>texto en negrita</b> dentro`).

## Fase 2: Modernización de la Interfaz de Usuario (UX) (Completada)

*   [x] **Tarea 2.1:** Implementar y activar el modal HTML/CSS (`.highlight-comment-modal`) para añadir/editar comentarios, eliminando el uso de `prompt()`.
*   [x] **Tarea 2.2:** Reemplazar la alerta `confirm()` de eliminación por una confirmación dentro del modal o una UI no bloqueante.
*   [x] **Tarea 2.3:** Añadir un botón para editar un comentario existente.

## Fase 3: Optimización de Rendimiento

*   [x] **Tarea 3.1:** Modificar `restoreHighlights` para que verifique si una anotación ya ha sido renderizada antes de intentar volver a crearla.
*   [ ] **Tarea 3.2:** Refinar el uso de `MutationObserver` para que sea menos agresivo en páginas muy dinámicas.
