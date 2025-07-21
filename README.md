# Quantum Highlighter PRO

Un script de usuario (UserScript) para navegadores web que permite resaltar y tomar notas en cualquier página web, inspirado en el sistema de anotaciones de Zotero.

## Características principales

*   **Dos tipos de anotación:** Resalta texto con un color de fondo o subráyalo.
*   **Ocho colores disponibles:** Personaliza tus notas con una paleta de 8 colores (amarillo, rojo, verde, azul, morado, rosa, naranja, gris).
*   **Menú contextual flotante:** Un menú limpio y moderno aparece al seleccionar texto o al hacer clic en una anotación existente para una edición rápida.
*   **Persistencia de datos:** Las anotaciones se guardan en el `localStorage` de tu navegador y se recargan automáticamente cuando vuelves a visitar la página.
*   **Atajos de teclado:**
    *   `Esc`: Cierra el menú contextual o cancela la selección de texto actual.
    *   `Supr`: Elimina la anotación que esté seleccionada.
*   **Manejo inteligente de entradas:** Los atajos de teclado se desactivan automáticamente cuando estás escribiendo en un campo de texto para no interferir.
*   **Selección precisa:** El script recorta automáticamente los espacios en blanco al inicio y al final de tu selección para mantener las notas limpias.
*   **Soporte multi-idioma:** La interfaz está disponible en español, inglés, francés, portugués, ruso y chino.
*   **Ligero y rápido:** Escrito en JavaScript puro y moderno, solo depende de la ligera librería `@floating-ui/dom` para el posicionamiento del menú.

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
2.  **Anota:** Aparecerá un pequeño menú flotante.
    *   Elige uno de los **colores** para crear la anotación.
    *   Puedes cambiar entre el modo de resaltado (`A`) y subrayado (`A` con una línea debajo) antes de seleccionar el color.
3.  **Gestiona tus anotaciones:**
    *   Haz **clic** en cualquier anotación existente para abrir el menú de nuevo.
    *   Desde el menú puedes cambiar el color, el tipo de anotación o hacer clic en **"Borrar"** para eliminarla.

## Configuración

### Cómo cambiar el idioma

Por defecto, el script está en español. Para cambiarlo:
1.  Abre el editor de scripts en Tampermonkey (o tu gestor preferido).
2.  Busca la línea `const preferredLanguage = 'es';`.
3.  Cambia `'es'` por el código del idioma que prefieras. Los códigos soportados son:
    *   `'en'`: Inglés
    *   `'es'`: Español
    *   `'fr'`: Francés
    *   `'pt'`: Portugués
    *   `'ru'`: Ruso
    *   `'zh'`: Chino
4.  Guarda los cambios.

## Desarrollo

El script está escrito en JavaScript moderno con una estructura orientada a objetos para separar las responsabilidades.

*   **`Highlighter`**: La clase principal que gestiona los eventos, el estado y la lógica de la aplicación.
*   **`DOMManager`**: Clase estática con métodos para interactuar con el DOM, como obtener el XPath de un nodo, envolver rangos de texto y aplicar estilos.
*   **`HighlightStorage`**: Se encarga de guardar y cargar las anotaciones en el `localStorage`.
*   **`HighlightMenu`**: Gestiona la creación y visualización del menú contextual usando `@floating-ui/dom`.
*   **Internacionalización (i18n)**: Las cadenas de texto están centralizadas en el objeto `i18n` para facilitar la traducción y el mantenimiento.
*   **Estilos**: Los estilos CSS están inyectados directamente en el script para asegurar que funcione sin necesidad de archivos externos.

## Licencia

Este proyecto está bajo la Licencia Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0).
