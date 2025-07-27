¡Hola! He revisado cuidadosamente la documentación de la API `chrome.i18n` que me indicaste, así como los archivos `i18n.js`, `welcome.html` y `script.js`.

Confirmo que he leído la documentación. Tu implementación actual es un sistema de internacionalización (i18n) personalizado y funcional, pero no aprovecha el sistema nativo de Chrome, que es el que se integra automáticamente con la Chrome Web Store para mostrar la descripción, el título y las traducciones de la interfaz a los usuarios en su idioma.

A continuación, te explico cómo puedes realizar la integración correcta utilizando el framework de internacionalización de Chrome, sin modificar tus archivos actuales.

### ¿Cómo funciona la Internacionalización Nativa de Chrome?

El sistema de Chrome se basa en una carpeta especial llamada `_locales`. Dentro de ella, creas una carpeta por cada idioma que soportas (ej. `en`, `es`, `fr`), y dentro de cada una de ellas, un archivo `messages.json` que contiene todas las cadenas de texto.

La extensión detectará automáticamente el idioma del navegador del usuario y cargará las cadenas correspondientes.

### Pasos para la Integración Correcta

Aquí te detallo el proceso para migrar tu sistema actual al de Chrome:

**1. Crear la Estructura de Carpetas y Archivos**

Primero, en el directorio raíz de tu extensión (`chrome_extension`), crea la siguiente estructura de carpetas:

```
_locales/
├── en/
│   └── messages.json
├── es/
│   └── messages.json
├── fr/
│   └── messages.json
├── pt/
│   └── messages.json
├── ru/
│   └── messages.json
└── zh/
    └── messages.json
```

**2. Convertir tus Traducciones al Formato `messages.json`**

Ahora, debes convertir tus objetos de JavaScript del archivo `i18n.js` al formato JSON que Chrome espera. Cada clave del JSON será un objeto con una propiedad `"message"`.

Por ejemplo, para el archivo `_locales/en/messages.json`, tomarías las traducciones de `translations.en`:

```json
{
  "sidebarTitle": {
    "message": "Annotations",
    "description": "The title of the sidebar."
  },
  "noAnnotationsTitle": {
    "message": "No Annotations Yet",
    "description": "Title shown when there are no annotations."
  },
  "noAnnotations": {
    "message": "Highlight text on the page to get started!",
    "description": "Helper text shown when there are no annotations."
  },
  "toolbarBold": {
    "message": "Bold",
    "description": "Tooltip for the bold button in the editor toolbar."
  },
  "colors_yellow": {
    "message": "Yellow",
    "description": "The color yellow."
  },
  "colors_red": {
    "message": "Red",
    "description": "The color red."
  }
}
```

**Nota importante sobre objetos anidados:** El formato `messages.json` no soporta objetos anidados como tu objeto `colors`. Debes aplanar las claves. Por ejemplo, `colors: { yellow: "Yellow" }` se convierte en `colors_yellow: { "message": "Yellow" }`.

Deberás hacer esto para cada idioma, creando el `messages.json` correspondiente en su respectiva carpeta (`es`, `fr`, `pt`, `ru`, `zh`).

**3. Modificar `manifest.json`**

Para que Chrome sepa qué idioma usar por defecto y para que pueda traducir el nombre y la descripción de tu extensión en la tienda, modifica tu `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "__MSG_extensionName__",
  "description": "__MSG_extensionDescription__",
  "default_locale": "en"
}
```

Y en tus archivos `messages.json` (por ejemplo, en `en/messages.json`), añade esas claves:

```json
{
  "extensionName": {
    "message": "Quantum Highlighter PRO",
    "description": "The name of the extension."
  },
  "extensionDescription": {
    "message": "The smartest way to highlight, underline, and take notes on any website.",
    "description": "The description of the extension."
  }
}
```

**4. [HECHO] Usar las Traducciones en JavaScript (`script.js`, `sidebar.js`)**

Ahora puedes reemplazar tu lógica personalizada. En lugar de pasar un objeto `lang`, usarás la API `chrome.i18n.getMessage()`.

**Antes (en `script.js`):**
```javascript
function buildToolbar(toolbarContainer, editor, lang) {
    toolbarContainer.innerHTML = `
        <button data-action="bold" title="${lang.toolbarBold}"><img src="/images/bold.svg"></button>
        <button data-action="italic" title="${lang.toolbarItalic}"><img src="/images/italic.svg"></button>
    `;
}
```

**Después (con la API de Chrome):**
```javascript
function buildToolbar(toolbarContainer, editor) {
    toolbarContainer.innerHTML = `
        <button data-action="bold" title="${chrome.i18n.getMessage('toolbarBold')}"><img src="/images/bold.svg"></button>
        <button data-action="italic" title="${chrome.i18n.getMessage('toolbarItalic')}"><img src="/images/italic.svg"></button>
    `;
}
```


NOTA IMPORNTANTE:
1. Usar la regla `(this\.)?lang\.([a-zA-Z0-9_]+)` para reemplazarla por `chrome.i18n.getMessage("$2")`.
2. Además, eliminar manualmente la llamada a `lang` en los parámetros de las funciones. Esto en los siguientes archivos:
3. Modificar la estructura de la llamada a colores (porque ahora están anidados en el i18n.js, pero no estarán anidados en el `messages.json`).

Archivos a revisar (al menos):
- script.js
- sidebar.js
- sidebar.html
- welcome.html

Ya no necesitarías importar `i18n.js` ni tener la lógica para seleccionar el idioma; Chrome lo hace por ti.

**5. Usar las Traducciones en HTML (`welcome.html`, `sidebar.html`)**

Tienes dos opciones para el HTML:

*   **Opción A (Recomendada para ti):** Mantén tus atributos `data-i18n` y usa JavaScript para poblarlos. Esto es más limpio y potente. En `welcome.html`, podrías reemplazar todo el objeto `translations` y la lógica de `applyTranslations` con una función más simple:

    ```javascript
    // En welcome.html, dentro del script
    document.addEventListener('DOMContentLoaded', () => {
        // Función para poblar todos los elementos con data-i18n
        function localizeHtmlPage() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                const message = chrome.i18n.getMessage(key);
                if (message) {
                    // Lógica para manejar elementos con spans o contenido HTML
                    if (el.children.length > 0 && key !== 'ctaTip') {
                        const span = el.querySelector('span');
                        if (span) span.textContent = message;
                    } else {
                        el.innerHTML = message;
                    }
                }
            });
            // También para el título de la página
            document.title = chrome.i18n.getMessage('pageTitle');
        }

        localizeHtmlPage();
        // Aquí iría el resto de tu lógica de `initialize()` para la página.
    });
    ```

*   **Opción B (Menos flexible):** Usar marcadores `__MSG_key__` directamente en el HTML. Chrome los reemplazará al cargar la página.

    ```html
    <h1>__MSG_heroTitle__</h1>
    <p class="subtitle">__MSG_heroSubtitle__</p>
    ```
    Esta opción no funciona para atributos que no sean de texto (como `title`) y puede ser menos flexible si necesitas lógica compleja.

### Resumen de Ventajas del Método Nativo

1.  **Integración con la Chrome Web Store:** Tu ficha de la tienda (título, descripción, capturas de pantalla) se mostrará en el idioma del usuario automáticamente.
2.  **Eficiencia:** No necesitas cargar un gran archivo JS con todas las traducciones en cada página. Chrome gestiona la carga de forma nativa.
3.  **Estandarización:** Es el método oficial y recomendado, lo que garantiza compatibilidad futura.
4.  **Simplicidad:** Eliminas la lógica manual para detectar el idioma y seleccionar el objeto de traducción correcto.

Si sigues estos pasos, tendrás una internacionalización robusta, eficiente y perfectamente integrada con el ecosistema de Chrome.