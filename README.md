# Quantum Highlighter WEB

Un script de usuario (UserScript) para navegadores web que permite resaltar y tomar notas en cualquier página web, inspirado en el sistema de anotaciones de Zotero.

## Características

*   **Resaltado y subrayado:** Selecciona texto en cualquier página y elige un color para resaltarlo o subrayarlo.
*   **Menú contextual flotante:** Un menú limpio y moderno aparece al seleccionar texto o al hacer clic en una anotación existente.
*   **Personalización:** Cambia el color o el tipo (resaltado/subrayado) de cualquier anotación en cualquier momento.
*   **Persistencia:** Las anotaciones se guardan localmente en tu navegador y se recargan automáticamente cuando vuelves a visitar la página.
*   **Atajos de teclado:**
    *   `Esc`: Cierra el menú o cancela la selección de texto actual.
    *   `Supr`: Elimina la anotación seleccionada.
*   **Inteligente:** Los atajos de teclado se desactivan automáticamente cuando estás escribiendo en un campo de texto para no interferir.
*   **Ligero y rápido:** No requiere de pesadas librerías y se ejecuta eficientemente.

## Instalación

Para usar este script, necesitas una extensión de navegador que gestione scripts de usuario, como:

*   [Tampermonkey](https://www.tampermonkey.net/) (recomendado)
*   [Greasemonkey](https://www.greasespot.net/)
*   [Violentmonkey](https://violentmonkey.github.io/)

Una vez que tengas la extensión instalada, puedes instalar el script desde [Greasy Fork](ENLACE_A_GREASYFORK) o instalarlo manualmente:

1.  Abre el panel de control de Tampermonkey (o tu gestor de scripts).
2.  Ve a la pestaña "Utilidades" y en "Instalar desde URL" pega la URL del archivo `script_v2.js` de este repositorio.
3.  Haz clic en "Instalar".

## Uso

1.  **Selecciona texto:** Simplemente arrastra el ratón sobre el texto que quieres anotar en cualquier página web.
2.  **Anota:** Aparecerá un pequeño menú.
    *   Elige uno de los **colores** para crear la anotación.
    *   Puedes cambiar entre el modo de resaltado (`A`) y subrayado (`A` con una línea debajo) antes de seleccionar el color.
3.  **Gestiona tus anotaciones:**
    *   Haz **clic** en cualquier anotación existente para abrir el menú de nuevo.
    *   Puedes cambiar el color, el tipo o hacer clic en **"Borrar"** para eliminarla.

## Desarrollo

Este script está escrito en JavaScript plano y utiliza la librería `@floating-ui/dom` para posicionar el menú contextual de forma inteligente.

*   **`script_v2.js`**: El código fuente principal del script.
*   **Estilos**: Los estilos CSS están inyectados directamente en el script para asegurar que funcione sin necesidad de archivos externos.
*   **Almacenamiento**: Las anotaciones se guardan en el `localStorage` del navegador, con una clave única para cada página.

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
