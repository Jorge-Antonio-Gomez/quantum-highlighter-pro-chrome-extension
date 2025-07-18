# Especificación inicial:

### **Hoja de Diseño: Sistema de Anotaciones Web**

**1. Objetivo General**

Crear un sistema de anotaciones en página que permita a los usuarios seleccionar texto para (1) aplicar rápidamente un resaltado o subrayado de color, y (2) añadir de forma opcional comentarios y etiquetas a dichas anotaciones. La interacción debe ser fluida, contextual y no intrusiva. Se usará en Tampermonkey como highlighter.

**2. Componentes de la Interfaz (UI Components)**

El sistema se compone de tres elementos principales:

*   **A. Anotación Visual:** El texto modificado en la página.
*   **B. Menú Rápido de Anotación:** El menú emergente que aparece al seleccionar texto.
*   **C. Panel de Detalles de Anotación:** El panel que aparece al hacer clic en una anotación existente.

---

### **A. Anotación Visual**

Es el resultado final de la acción del usuario sobre el texto.

*   **Tipos:**
    1.  **Resaltado (Highlight):** El fondo del texto cambia de color.
    2.  **Subrayado (Underline):** Una línea de color aparece debajo del texto.

*   **Especificaciones de Diseño:**
    *   **Resaltado:** Utilizar la propiedad CSS `background-color`. El color debe tener cierta transparencia (e.g., `rgba(255, 229, 0, 0.5)`) para no ocultar el texto si este es oscuro.
    *   **Subrayado:** No usar `text-decoration: underline`. En su lugar, usar `border-bottom` para un control total sobre el grosor, estilo (sólido, punteado) y color. Se recomienda un grosor de `2px`.
    *   **Estado Hover:** Al pasar el cursor sobre una anotación existente, el cursor debe cambiar a `cursor: pointer` y la anotación podría tener un sutil efecto de `hover` (ej. un ligero aumento en la opacidad o un borde fino) para indicar que es interactiva.

*   **Especificaciones Técnicas:**
    *   Cada anotación debe ser un elemento HTML que envuelva el texto, preferiblemente `<mark>` o `<span>`.
    *   Cada elemento debe tener un identificador único para vincularlo a sus datos (comentarios, etiquetas). Ejemplo: `<mark data-annotation-id="xyz-123">texto resaltado</mark>`.

---

### **B. Menú Rápido de Anotación**

Es la herramienta principal para crear anotaciones.

*   **Disparador (Trigger):** Aparece al finalizar una selección de texto (evento `mouseup` si `window.getSelection().toString().length > 0`).
*   **Posicionamiento:** Flota justo encima o debajo de la selección de texto, con un pequeño triángulo (caret) apuntando hacia ella.
*   **Diseño y Layout:**
    *   **Contenedor:** Un rectángulo con esquinas redondeadas (`border-radius: 8px`), fondo blanco (`#FFFFFF`) y una sombra sutil (`box-shadow`) para darle profundidad.
    *   **Sección 1: Paleta de Colores (Fila Superior):**
        *   Una fila de 8 selectores de color.
        *   Cada selector es un cuadrado con un color sólido.
        *   Al pasar el cursor (`hover`), el selector puede aumentar ligeramente de tamaño o tener un borde para indicar que es seleccionable.
    *   **Sección 2: Selector de Modo (Fila Inferior):**
        *   Dos botones que controlan el tipo de anotación.
        *   **Botón 1 (Resaltado):** Icono o texto (ej. "A" con fondo). Es el modo por defecto.
        *   **Botón 2 (Subrayado):** Icono o texto (ej. "A" con subrayado).
        *   **Estado Activo:** El botón del modo seleccionado debe tener un estilo visualmente distinto (ej. un fondo gris claro o un borde de acento).

*   **Comportamiento:**
    *   Al hacer clic en un color, se aplica la anotación correspondiente (según el modo activo) y el menú desaparece.
    *   Al hacer clic fuera del menú (en cualquier otra parte de la página), el menú desaparece sin realizar ninguna acción.

---

### **C. Panel de Detalles de Anotación**

Permite gestionar los metadatos de una anotación ya creada.

*   **Disparador (Trigger):** Aparece al hacer clic en una `Anotación Visual` existente.
*   **Posicionamiento:** Flota anclado a la anotación sobre la que se hizo clic.
*   **Diseño y Layout:**
    *   **Contenedor:** Más grande que el Menú Rápido, pero con el mismo estilo base (esquinas redondeadas, fondo blanco, sombra).
    *   **Cabecera (Header):**
        *   **Contexto (Opcional):** Muestra información de contexto (ej. "Página 6", "Sección 2.1").
        *   **Menú de Opciones:** Un icono de tres puntos (`...`) a la derecha. Al hacer clic, despliega opciones como "Eliminar anotación" o "Copiar texto".
    *   **Cuerpo (Body):**
        *   **Campo de Comentario:** Un área de texto (`<textarea>`) con un placeholder claro como "Añadir un comentario...". El texto del comentario guardado se muestra aquí.
    *   **Pie (Footer):**
        *   **Gestor de Etiquetas (Tags):**
            *   Un campo de entrada de texto con el placeholder "Añadir etiquetas...".
            *   Al escribir y presionar `Enter`, la etiqueta se convierte en una "píldora" (un pequeño contenedor con texto y un icono 'x' para eliminarla).
            *   Las etiquetas existentes se muestran como una lista de estas píldoras.

*   **Comportamiento:**
    *   Los cambios en el comentario se guardan automáticamente al perder el foco (`onblur`) del área de texto.
    *   Las etiquetas se añaden/eliminan instantáneamente.
    *   Al hacer clic fuera del panel, este desaparece.

---

### **D. Menú Contextual de Anotación**

Este es el menú que aparece al hacer clic sobre una anotación ya existente. Es distinto del "Panel de Detalles" porque su objetivo es la modificación rápida (color, tipo, borrado) en lugar de la gestión de metadatos (comentarios, etiquetas).

*   **Disparador (Trigger):** Un solo clic (`click`) sobre un elemento de anotación existente (un `<mark>` o `<span>` con el atributo `data-annotation-id`).
*   **Posicionamiento:** Flota anclado a la anotación sobre la que se hizo clic, preferiblemente encima o debajo, con un pequeño triángulo (caret) apuntando hacia ella.
*   **Diseño y Layout:**
    *   **Contenedor:** Sigue el estilo base (esquinas redondeadas, fondo blanco, sombra), similar en tamaño al "Menú Rápido".
    *   **Sección 1: Información y Acciones Principales:**
        *   **Contexto:** Muestra información como "Página 16".
        *   **Añadir a nota:** Un botón o enlace con el texto "Añadir a nota" o "Añadir comentario", que al ser presionado, abriría el **Panel de Detalles de Anotación (C)**.
    *   **Sección 2: Paleta de Colores:**
        *   Una fila de selectores de color, idéntica a la del "Menú Rápido", para cambiar el color de la anotación actual. El color activo debe estar visualmente destacado.
    *   **Sección 3: Acciones de Modificación y Borrado:**
        *   **Convertir tipo:** Un botón con el texto "Convertir a subrayado" (si la anotación es un resaltado) o "Convertir a resaltado" (si es un subrayado).
        *   **Borrar:** Un botón con el texto "Borrar" para eliminar la anotación por completo.

### **2.1 Lógica de Selección Inteligente (Trim de Espacios)**

Esta especificación refina el comportamiento de la selección de texto para hacerla más precisa y limpia.

*   **Comportamiento:** El sistema debe limpiar automáticamente la selección del usuario para excluir cualquier espacio en blanco (`whitespace`) que se encuentre al principio o al final del texto seleccionado.
*   **Ejemplo:**
    *   Si el usuario selecciona `" La creación de este índice "`.
    *   El sistema debe tratar la selección como si fuera `"La creación de este índice"`.
*   **Impacto:** Esto asegura que las anotaciones no incluyan espacios innecesarios, lo que mejora la consistencia de los datos y la apariencia visual. Esta lógica se aplica *antes* de mostrar el "Menú Rápido de Anotación".

### **Flujos de Interacción (User Flows)**

**Flujo 1: Crear una nueva anotación de resaltado**
1.  **Usuario:** Selecciona un fragmento de texto.
2.  **Sistema:** Muestra el `Menú Rápido de Anotación`. El modo "Resaltado" está activo por defecto.
3.  **Usuario:** Hace clic en un color (ej. amarillo).
4.  **Sistema:**
    *   Envuelve el texto seleccionado en `<mark data-annotation-id="[id-único]" style="background-color: [color-amarillo];">`.
    *   Oculta el `Menú Rápido`.
    *   Guarda la nueva anotación en la estructura de datos.

**Flujo 2: Añadir un comentario y una etiqueta**
1.  **Usuario:** Hace clic en una anotación de resaltado existente.
2.  **Sistema:** Muestra el `Panel de Detalles de Anotación`, vacío o con datos previos.
3.  **Usuario:** Escribe "Este es un punto clave" en el campo de comentario.
4.  **Usuario:** Hace clic en el campo de etiquetas, escribe "Importante" y presiona `Enter`.
5.  **Sistema:** Muestra la etiqueta "Importante" como una píldora.
6.  **Usuario:** Hace clic fuera del panel.
7.  **Sistema:**
    *   Oculta el `Panel de Detalles`.
    *   Actualiza la estructura de datos de la anotación con el nuevo comentario y la etiqueta.
    *   (Opcional) Muestra un pequeño icono de comentario junto a la anotación en el texto para indicar que tiene contenido adicional.

**Flujo 3: Modificar una anotación existente (anidación)**
1.  **Usuario:** Selecciona una palabra *dentro* de una anotación ya existente.
2.  **Sistema:** Muestra el `Menú Rápido de Anotación`.
3.  **Usuario:** Selecciona un color diferente (ej. rojo).
4.  **Sistema:**
    *   Debe ser capaz de dividir el `<mark>` original.
    *   Ejemplo: `<mark>Texto <mark style="background-color: red;">palabra</mark> resto</mark>`.
    *   Esta es la parte técnicamente más compleja y requiere una manipulación cuidadosa del DOM.

**Flujo 4: Modificar el color de una anotación existente**
1.  **Usuario:** Hace clic en una anotación de resaltado amarilla existente.
2.  **Sistema:** Muestra el `Menú Contextual de Anotación` anclado a la anotación.
3.  **Usuario:** Hace clic en el selector de color verde en la paleta del menú.
4.  **Sistema:**
    *   Cambia el estilo del elemento `<mark>` correspondiente (ej. `style="background-color: [color-verde];"`).
    *   Actualiza el atributo `color` en la estructura de datos de esa anotación.
    *   Oculta el `Menú Contextual`.

**Flujo 5: Eliminar una anotación**
1.  **Usuario:** Hace clic en una anotación existente.
2.  **Sistema:** Muestra el `Menú Contextual de Anotación`.
3.  **Usuario:** Hace clic en el botón "Borrar".
4.  **Sistema:**
    *   Elimina el elemento `<mark>` o `<span>` del DOM, restaurando el texto a su estado original.
    *   Elimina el objeto de la anotación de la estructura de datos (`AnnotationSystem.annotations`).
    *   Oculta el `Menú Contextual`.

---

### **Especificaciones Técnicas Clave**

*   **Estructura de Datos:** Se debe mantener un objeto o array en JavaScript que represente todas las anotaciones. Cada objeto de anotación debe contener:
    ```json
    {
      "id": "xyz-123",
      "type": "highlight", // o "underline"
      "color": "yellow", // o código HEX/RGB
      "text": "texto resaltado",
      "comment": "Este es un punto clave",
      "tags": ["Importante", "Revisar"],
      "domPointers": { /* Métodos para re-encontrar la anotación en el DOM */ }
    }
    ```
*   **Persistencia:** Para que las anotaciones sobrevivan a una recarga de página, la estructura de datos debe guardarse en `localStorage` (solución simple) o enviarse a un backend a través de una API (solución robusta).
*   **Manipulación del DOM:** Usar `window.getSelection()` y los objetos `Range` para identificar y manipular el texto seleccionado de manera precisa y robusta, incluso a través de múltiples nodos HTML.


# **HOJA DE DESARROLLO: Sistema de Anotaciones Web**
*Inspirado en el highlighter del lector PDF de Zotero*

## **📋 ÍNDICE DE DESARROLLO**

### **Fase 1: Arquitectura Base**
### **Fase 2: Interfaz de Usuario**
### **Fase 3: Gestión de Datos**
### **Fase 4: Interacciones Avanzadas**
### **Fase 5: Optimización y Testing**

---

## **🏗️ FASE 1: ARQUITECTURA BASE**

### **1.1 Estructura de Datos Principal**

```javascript
// Objeto principal del sistema
const AnnotationSystem = {
    annotations: new Map(), // Mapa de anotaciones por ID
    settings: {
        defaultMode: 'highlight',
        autoSave: true,
        contextInfo: true
    },
    state: {
        activeMenu: null,
        selectedText: null,
        currentMode: 'highlight'
    }
};

// Estructura de una anotación individual
const AnnotationSchema = {
    id: 'string',           // UUID único
    type: 'highlight|underline',
    color: 'string',        // Color en formato hex/rgb
    text: 'string',         // Texto original
    comment: 'string',      // Comentario opcional
    tags: ['string'],       // Array de etiquetas
    timestamp: 'number',    // Timestamp de creación
    url: 'string',          // URL de la página
    domPointers: {
        startContainer: 'Node',
        endContainer: 'Node',
        startOffset: 'number',
        endOffset: 'number',
        xpath: 'string'      // XPath para recuperación
    },
    metadata: {
        pageTitle: 'string',
        section: 'string'    // Contexto de la página
    }
};
```

### **1.2 Sistema de Eventos Base**

```javascript
// Eventos principales del sistema
const EventHandlers = {
    // Selección de texto
    onMouseUp: handleTextSelection, // Este manejador contendrá la lógica de activación condicional
    
    // Clicks en anotaciones
    onAnnotationClick: handleAnnotationClick, // Dispara el Menú Contextual
    
    // Menús y paneles
    onMenuAction: handleMenuAction,
    onPanelUpdate: handlePanelUpdate,
    
    // Persistencia
    onBeforeUnload: saveAnnotations,
    onLoad: loadAnnotations
};

// Lógica del manejador de selección
function handleTextSelection(event) {
    // Prevenir que el menú aparezca si se hace clic en una anotación existente
    if (event.target.closest('[data-annotation-id]')) {
        return;
    }

    const selection = DOMUtils.getTextSelection();
    
    // Condición 1: La selección no debe estar colapsada
    if (selection.isCollapsed) {
        // Ocultar menú si estaba visible
        AnnotationSystem.state.activeMenu?.hide();
        return;
    }
    
    // Condición 2: El texto, después de limpiarlo, debe tener contenido
    const trimmedText = selection.toString().trim();
    if (trimmedText.length === 0) {
        // Ocultar menú si estaba visible
        AnnotationSystem.state.activeMenu?.hide();
        return;
    }
    
    // Si pasa las validaciones, mostrar el Menú Rápido
    const bounds = DOMUtils.getSelectionBounds(selection);
    const quickMenu = new QuickAnnotationMenu(); // Instanciar el menú
    quickMenu.show(bounds.x + (bounds.width / 2), bounds.y);
    AnnotationSystem.state.activeMenu = quickMenu;
}
```

### **1.3 Utilidades DOM**

```javascript
// Funciones de manipulación DOM
const DOMUtils = {
    // Selección y rangos
    getTextSelection: () => window.getSelection(),
    createRange: (startNode, startOffset, endNode, endOffset),
    
    // Wrapping de texto
    wrapTextInElement: (range, tagName, attributes),
    unwrapElement: (element),
    
    // XPath y recuperación
    getXPathForNode: (node),
    getNodeFromXPath: (xpath),
    
    // Posicionamiento
    getSelectionBounds: (selection),
    getElementBounds: (element),
    
    // Validación
    isValidTextNode: (node),
    isWithinAnnotation: (node),
    
    // NUEVA FUNCIÓN: Ajusta un objeto Range para excluir espacios al inicio y final
    trimSelectionRange: (range) => {
        let { startContainer, endContainer, startOffset, endOffset } = range;

        // Trim del inicio
        if (startContainer.nodeType === Node.TEXT_NODE) {
            while (startOffset < startContainer.length && /\s/.test(startContainer.textContent[startOffset])) {
                startOffset++;
            }
        }

        // Trim del final
        if (endContainer.nodeType === Node.TEXT_NODE) {
            while (endOffset > 0 && /\s/.test(endContainer.textContent[endOffset - 1])) {
                endOffset--;
            }
        }

        const newRange = document.createRange();
        newRange.setStart(startContainer, startOffset);
        newRange.setEnd(endContainer, endOffset);
        
        return newRange;
    }
};
```

---

## **🎨 FASE 2: INTERFAZ DE USUARIO**

### **2.1 Estilos CSS Base**

```css
/* Variables CSS para consistencia */
:root {
    --annotation-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    --annotation-border-radius: 8px;
    --annotation-z-index: 10000;
    --annotation-transition: all 0.2s ease;
}

/* Contenedores base */
.annotation-menu,
.annotation-panel {
    position: absolute;
    background: white;
    border-radius: var(--annotation-border-radius);
    box-shadow: var(--annotation-shadow);
    z-index: var(--annotation-z-index);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
}

/* Anotaciones visuales */
.annotation-highlight {
    background-color: rgba(255, 229, 0, 0.5);
    cursor: pointer;
    transition: var(--annotation-transition);
}

.annotation-underline {
    border-bottom: 2px solid #007acc;
    cursor: pointer;
    transition: var(--annotation-transition);
}

/* Estados hover */
.annotation-highlight:hover,
.annotation-underline:hover {
    opacity: 0.8;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}
```

### **2.2 Menú Rápido de Anotación**

```javascript
// Estructura del menú rápido
class QuickAnnotationMenu {
    constructor() {
        this.element = null;
        this.colors = [
            '#FFE066', '#FF6B6B', '#4ECDC4', '#45B7D1',
            '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'
        ];
        this.currentMode = 'highlight';
    }
    
    create() {
        // Crear estructura del menú
        const menu = document.createElement('div');
        menu.className = 'annotation-menu quick-menu';
        
        // Sección de colores
        const colorSection = this.createColorSection();
        
        // Sección de modos
        const modeSection = this.createModeSection();
        
        menu.appendChild(colorSection);
        menu.appendChild(modeSection);
        
        return menu;
    }
    
    createColorSection() {
        const section = document.createElement('div');
        section.className = 'color-palette';
        
        this.colors.forEach(color => {
            const colorButton = document.createElement('button');
            colorButton.className = 'color-selector';
            colorButton.style.backgroundColor = color;
            colorButton.dataset.color = color;
            colorButton.addEventListener('click', (e) => this.selectColor(e));
            section.appendChild(colorButton);
        });
        
        return section;
    }
    
    createModeSection() {
        const section = document.createElement('div');
        section.className = 'mode-selector';
        
        const highlightBtn = this.createModeButton('highlight', '🖍️', 'Resaltar');
        const underlineBtn = this.createModeButton('underline', '📝', 'Subrayar');
        
        section.appendChild(highlightBtn);
        section.appendChild(underlineBtn);
        
        return section;
    }
    
    show(x, y) {
        if (!this.element) {
            this.element = this.create();
            document.body.appendChild(this.element);
        }
        
        this.position(x, y);
        this.element.style.display = 'block';
        this.element.classList.add('show');
    }
    
    hide() {
        if (this.element) {
            this.element.classList.remove('show');
            this.element.style.display = 'none';
        }
    }
    
    position(x, y) {
        const rect = this.element.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Ajustar posición para evitar overflow
        let finalX = x - (rect.width / 2);
        let finalY = y - rect.height - 10;
        
        if (finalX < 0) finalX = 10;
        if (finalX + rect.width > viewport.width) {
            finalX = viewport.width - rect.width - 10;
        }
        
        if (finalY < 0) finalY = y + 20;
        
        this.element.style.left = finalX + 'px';
        this.element.style.top = finalY + 'px';
    }
}
```

### **2.3 Panel de Detalles de Anotación**

```javascript
class AnnotationDetailPanel {
    constructor() {
        this.element = null;
        this.currentAnnotation = null;
    }
    
    create() {
        const panel = document.createElement('div');
        panel.className = 'annotation-panel detail-panel';
        
        // Cabecera
        const header = this.createHeader();
        
        // Cuerpo con comentario
        const body = this.createBody();
        
        // Pie con etiquetas
        const footer = this.createFooter();
        
        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        
        return panel;
    }
    
    createHeader() {
        const header = document.createElement('div');
        header.className = 'panel-header';
        
        const context = document.createElement('span');
        context.className = 'context-info';
        
        const menu = document.createElement('button');
        menu.className = 'options-menu';
        menu.innerHTML = '⋯';
        menu.addEventListener('click', this.showOptionsMenu.bind(this));
        
        header.appendChild(context);
        header.appendChild(menu);
        
        return header;
    }
    
    createBody() {
        const body = document.createElement('div');
        body.className = 'panel-body';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'comment-field';
        textarea.placeholder = 'Añadir un comentario...';
        textarea.addEventListener('blur', this.saveComment.bind(this));
        textarea.addEventListener('input', this.autoResize.bind(this));
        
        body.appendChild(textarea);
        
        return body;
    }
    
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'panel-footer';
        
        const tagContainer = document.createElement('div');
        tagContainer.className = 'tag-container';
        
        const tagInput = document.createElement('input');
        tagInput.className = 'tag-input';
        tagInput.placeholder = 'Añadir etiquetas...';
        tagInput.addEventListener('keypress', this.handleTagInput.bind(this));
        
        const tagList = document.createElement('div');
        tagList.className = 'tag-list';
        
        tagContainer.appendChild(tagInput);
        tagContainer.appendChild(tagList);
        footer.appendChild(tagContainer);
        
        return footer;
    }
    
    show(annotation, x, y) {
        this.currentAnnotation = annotation;
        
        if (!this.element) {
            this.element = this.create();
            document.body.appendChild(this.element);
        }
        
        this.populate(annotation);
        this.position(x, y);
        this.element.style.display = 'block';
        this.element.classList.add('show');
    }
    
    populate(annotation) {
        // Llenar contexto
        const contextInfo = this.element.querySelector('.context-info');
        contextInfo.textContent = annotation.metadata.section || document.title;
        
        // Llenar comentario
        const commentField = this.element.querySelector('.comment-field');
        commentField.value = annotation.comment || '';
        
        // Llenar etiquetas
        this.renderTags(annotation.tags || []);
    }
    
    renderTags(tags) {
        const tagList = this.element.querySelector('.tag-list');
        tagList.innerHTML = '';
        
        tags.forEach(tag => {
            const tagPill = this.createTagPill(tag);
            tagList.appendChild(tagPill);
        });
    }
    
    createTagPill(tagText) {
        const pill = document.createElement('span');
        pill.className = 'tag-pill';
        pill.innerHTML = `
            <span class="tag-text">${tagText}</span>
            <button class="tag-remove" data-tag="${tagText}">×</button>
        `;
        
        pill.querySelector('.tag-remove').addEventListener('click', (e) => {
            this.removeTag(e.target.dataset.tag);
        });
        
        return pill;
    }
}
```

### **2.4 Menú Contextual de Anotación**

```javascript
// NUEVA CLASE: Menú que aparece al hacer clic en una anotación
class AnnotationContextMenu {
    constructor() {
        this.element = null;
        this.currentAnnotation = null;
        this.colors = [
            '#FFE066', '#FF6B6B', '#4ECDC4', '#45B7D1',
            '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'
        ];
    }
    
    create() {
        const menu = document.createElement('div');
        menu.className = 'annotation-menu context-menu';
        
        // Estructura interna del menú
        menu.innerHTML = `
            <div class="context-header">
                <span class="context-info"></span>
                <button class="add-note-btn">Añadir a nota</button>
            </div>
            <div class="color-palette"></div>
            <div class="context-actions">
                <button class="toggle-type-btn"></button>
                <button class="delete-btn">Borrar</button>
            </div>
        `;
        
        // Llenar paleta de colores
        const colorPalette = menu.querySelector('.color-palette');
        this.colors.forEach(color => {
            const colorButton = document.createElement('button');
            colorButton.className = 'color-selector';
            colorButton.style.backgroundColor = color;
            colorButton.dataset.color = color;
            colorPalette.appendChild(colorButton);
        });
        
        this.addEventListeners(menu);
        return menu;
    }
    
    addEventListeners(menu) {
        menu.querySelector('.delete-btn').addEventListener('click', () => this.handleDelete());
        menu.querySelector('.toggle-type-btn').addEventListener('click', () => this.handleToggleType());
        menu.querySelector('.add-note-btn').addEventListener('click', () => this.handleOpenDetailPanel());
        menu.querySelector('.color-palette').addEventListener('click', (e) => {
            if (e.target.dataset.color) {
                this.handleChangeColor(e.target.dataset.color);
            }
        });
    }
    
    show(annotation, x, y) {
        this.currentAnnotation = annotation;
        if (!this.element) {
            this.element = this.create();
            document.body.appendChild(this.element);
        }
        
        this.populate();
        this.position(x, y);
        this.element.style.display = 'block';
    }
    
    populate() {
        // Llenar info de contexto
        this.element.querySelector('.context-info').textContent = `Página ${this.currentAnnotation.metadata.pageNumber || 'N/A'}`;
        
        // Actualizar texto del botón de cambio de tipo
        const toggleBtn = this.element.querySelector('.toggle-type-btn');
        toggleBtn.textContent = this.currentAnnotation.type === 'highlight' ? 'Convertir a subrayado' : 'Convertir a resaltado';
    }
    
    // ... métodos para position(), hide(), handleChangeColor(), handleDelete(), etc.
}
```

---

## **💾 FASE 3: GESTIÓN DE DATOS**

### **3.1 Sistema de Persistencia**

```javascript
class AnnotationStorage {
    constructor() {
        this.storageKey = 'web-annotations';
        this.version = '2.0';
    }
    
    save(annotations) {
        try {
            const data = {
                version: this.version,
                timestamp: Date.now(),
                url: window.location.href,
                annotations: Array.from(annotations.entries())
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving annotations:', error);
            return false;
        }
    }
    
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return new Map();
            
            const parsed = JSON.parse(data);
            
            // Verificar versión y URL
            if (parsed.version !== this.version) {
                return this.migrate(parsed);
            }
            
            // Filtrar por URL actual
            const currentUrl = window.location.href;
            const annotations = new Map(parsed.annotations);
            
            // Filtrar anotaciones de esta página
            const pageAnnotations = new Map();
            for (const [id, annotation] of annotations) {
                if (annotation.url === currentUrl) {
                    pageAnnotations.set(id, annotation);
                }
            }
            
            return pageAnnotations;
        } catch (error) {
            console.error('Error loading annotations:', error);
            return new Map();
        }
    }
    
    migrate(oldData) {
        // Lógica de migración entre versiones
        console.log('Migrating annotation data...');
        return new Map();
    }
    
    export() {
        const data = localStorage.getItem(this.storageKey);
        if (!data) return null;
        
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotations-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    import(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    localStorage.setItem(this.storageKey, JSON.stringify(data));
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }
}
```

### **3.2 Gestión de XPath y Recuperación DOM**

```javascript
class DOMRestoration {
    static getXPathForElement(element) {
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        
        const parts = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = element.previousSibling;
            
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && 
                    sibling.tagName === element.tagName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            
            const tagName = element.tagName.toLowerCase();
            const part = `${tagName}[${index}]`;
            parts.unshift(part);
            
            element = element.parentNode;
        }
        
        return '/' + parts.join('/');
    }
    
    static getElementByXPath(xpath) {
        return document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
    }
    
    static createRangeFromPointers(domPointers) {
        try {
            const startElement = this.getElementByXPath(domPointers.startXPath);
            const endElement = this.getElementByXPath(domPointers.endXPath);
            
            if (!startElement || !endElement) return null;
            
            const range = document.createRange();
            range.setStart(startElement, domPointers.startOffset);
            range.setEnd(endElement, domPointers.endOffset);
            
            return range;
        } catch (error) {
            console.error('Error restoring range:', error);
            return null;
        }
    }
    
    static saveRangePointers(range) {
        return {
            startXPath: this.getXPathForElement(range.startContainer.nodeType === Node.TEXT_NODE ? 
                range.startContainer.parentNode : range.startContainer),
            endXPath: this.getXPathForElement(range.endContainer.nodeType === Node.TEXT_NODE ? 
                range.endContainer.parentNode : range.endContainer),
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            text: range.toString()
        };
    }
}
```

---

## **⚡ FASE 4: INTERACCIONES AVANZADAS**

### **4.1 Gestión de Selecciones Anidadas**

```javascript
class NestedAnnotationManager {
    static splitAnnotation(existingAnnotation, newRange) {
        const existingElement = document.querySelector(
            `[data-annotation-id="${existingAnnotation.id}"]`
        );
        
        if (!existingElement) return false;
        
        // Determinar si la nueva selección está dentro de la existente
        if (!this.isRangeWithinElement(newRange, existingElement)) {
            return false;
        }
        
        // Crear fragmentos: antes, durante y después de la nueva selección
        const fragments = this.splitTextContent(existingElement, newRange);
        
        // Reconstruir con la nueva anotación anidada
        this.reconstructWithNesting(existingElement, fragments, newRange);
        
        return true;
    }
    
    static isRangeWithinElement(range, element) {
        const elementRange = document.createRange();
        elementRange.selectNodeContents(element);
        
        try {
            return range.compareBoundaryPoints(Range.START_TO_START, elementRange) >= 0 &&
                   range.compareBoundaryPoints(Range.END_TO_END, elementRange) <= 0;
        } catch (error) {
            return false;
        }
    }
    
    static splitTextContent(element, newRange) {
        const fullText = element.textContent;
        const selectedText = newRange.toString();
        
        const startIndex = fullText.indexOf(selectedText);
        if (startIndex === -1) return null;
        
        const endIndex = startIndex + selectedText.length;
        
        return {
            before: fullText.substring(0, startIndex),
            selected: selectedText,
            after: fullText.substring(endIndex)
        };
    }
    
    static reconstructWithNesting(originalElement, fragments, newRange) {
        const parent = originalElement.parentNode;
        const originalId = originalElement.dataset.annotationId;
        const originalStyle = originalElement.style.cssText;
        
        // Crear fragmento antes
        if (fragments.before) {
            const beforeSpan = document.createElement('span');
            beforeSpan.textContent = fragments.before;
            beforeSpan.dataset.annotationId = originalId;
            beforeSpan.style.cssText = originalStyle;
            parent.insertBefore(beforeSpan, originalElement);
        }
        
        // Crear fragmento seleccionado (nuevo)
        const selectedSpan = document.createElement('span');
        selectedSpan.textContent = fragments.selected;
        // El nuevo estilo se aplicará desde el sistema principal
        parent.insertBefore(selectedSpan, originalElement);
        
        // Crear fragmento después
        if (fragments.after) {
            const afterSpan = document.createElement('span');
            afterSpan.textContent = fragments.after;
            afterSpan.dataset.annotationId = originalId;
            afterSpan.style.cssText = originalStyle;
            parent.insertBefore(afterSpan, originalElement);
        }
        
        // Remover elemento original
        parent.removeChild(originalElement);
        
        return selectedSpan;
    }
}
```

### **4.2 Sistema de Eventos Avanzado**

```javascript
class AdvancedEventManager {
    constructor() {
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
    }
    
    debounce(func, delay, key = 'default') {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        const timer = setTimeout(() => {
            func();
            this.debounceTimers.delete(key);
        }, delay);
        
        this.debounceTimers.set(key, timer);
    }
    
    throttle(func, delay, key = 'default') {
        if (this.throttleTimers.has(key)) {
            return;
        }
        
        func();
        
        const timer = setTimeout(() => {
            this.throttleTimers.delete(key);
        }, delay);
        
        this.throttleTimers.set(key, timer);
    }
    
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + Shift + H: Resaltar selección
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'H') {
            event.preventDefault();
            this.quickHighlight();
        }
        
        // Ctrl/Cmd + Shift + U: Subrayar selección
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'U') {
            event.preventDefault();
            this.quickUnderline();
        }
        
        // Escape: Cerrar menús abiertos
        if (event.key === 'Escape') {
            this.closeAllMenus();
        }
    }
    
    handleContextMenu(event) {
        const annotation = this.findAnnotationAtPoint(event.target);
        if (annotation) {
            event.preventDefault();
            this.showAnnotationContextMenu(event.pageX, event.pageY, annotation);
        }
    }
    
    findAnnotationAtPoint(element) {
        while (element && element !== document.body) {
            if (element.dataset.annotationId) {
                return element.dataset.annotationId;
            }
            element = element.parentNode;
        }
        return null;
    }
}
```

---

## **🔧 FASE 5: OPTIMIZACIÓN Y TESTING**

### **5.1 Sistema de Testing**

```javascript
class AnnotationTester {
    static runAllTests() {
        console.group('🧪 Annotation System Tests');
        
        this.testDataStructure();
        this.testDOMManipulation();
        this.testPersistence();
        this.testUIInteractions();
        
        console.groupEnd();
    }
    
    static testDataStructure() {
        console.group('📊 Data Structure Tests');
        
        // Test crear anotación
        const annotation = AnnotationManager.createAnnotation({
            type: 'highlight',
            color: '#FFE066',
            text: 'Test text'
        });
        
        console.assert(annotation.id, 'Annotation should have ID');
        console.assert(annotation.timestamp, 'Annotation should have timestamp');
        
        console.groupEnd();
    }
    
    static testDOMManipulation() {
        console.group('🌐 DOM Manipulation Tests');
        
        // Test XPath generation
        const element = document.body;
        const xpath = DOMRestoration.getXPathForElement(element);
        console.assert(xpath, 'Should generate XPath');
        
        // Test element recovery
        const recovered = DOMRestoration.getElementByXPath(xpath);
        console.assert(recovered === element, 'Should recover same element');
        
        console.groupEnd();
    }
    
    static testPersistence() {
        console.group('💾 Persistence Tests');
        
        const storage = new AnnotationStorage();
        const testData = new Map([['test', { id: 'test', text: 'test' }]]);
        
        const saved = storage.save(testData);
        console.assert(saved, 'Should save successfully');
        
        const loaded = storage.load();
        console.assert(loaded instanceof Map, 'Should load as Map');
        
        console.groupEnd();
    }
    
    static testUIInteractions() {
        console.group('🎨 UI Interaction Tests');
        
        // Test menu creation
        const menu = new QuickAnnotationMenu();
        const element = menu.create();
        console.assert(element.className.includes('annotation-menu'), 'Should create menu element');
        
        // Test panel creation
        const panel = new AnnotationDetailPanel();
        const panelElement = panel.create();
        console.assert(panelElement.className.includes('annotation-panel'), 'Should create panel element');
        
        console.groupEnd();
    }
}
```

### **5.2 Optimizaciones de Rendimiento**

```javascript
class PerformanceOptimizer {
    static optimizeForLargePages() {
        // Usar IntersectionObserver para anotaciones fuera de viewport
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const annotation = entry.target;
                if (entry.isIntersecting) {
                    annotation.classList.add('visible');
                } else {
                    annotation.classList.remove('visible');
                }
            });
        });
        
        // Observar todas las anotaciones
        document.querySelectorAll('[data-annotation-id]').forEach(annotation => {
            observer.observe(annotation);
        });
    }
    
    static batchDOMUpdates(updates) {
        // Usar requestAnimationFrame para batching
        requestAnimationFrame(() => {
            updates.forEach(update => update());
        });
    }
    
    static memoizeExpensiveOperations() {
        const cache = new Map();
        
        return function memoized(key, operation) {
            if (cache.has(key)) {
                return cache.get(key);
            }
            
            const result = operation();
            cache.set(key, result);
            return result;
        };
    }
}
```

---

## **📋 CHECKLIST DE IMPLEMENTACIÓN**

### **Fase 1: Base ✅**
- [ ] Estructura de datos principal
- [ ] Sistema de eventos base
- [ ] Utilidades DOM básicas
- [ ] Sistema de logging

### **Fase 2: UI ✅**
- [ ] Estilos CSS responsivos
- [ ] Menú rápido de anotación
- [ ] Panel de detalles
- [ ] Animaciones y transiciones

### **Fase 3: Datos ✅**
- [ ] Sistema de persistencia
- [ ] Gestión XPath
- [ ] Exportar/Importar
- [ ] Migración de versiones

### **Fase 4: Avanzado ✅**
- [ ] Anotaciones anidadas
- [ ] Atajos de teclado
- [ ] Menú contextual
- [ ] Gestión de conflictos

### **Fase 5: Optimización ✅**
- [ ] Testing automatizado
- [ ] Optimización de rendimiento
- [ ] Manejo de errores
- [ ] Documentación de API

---

## **🚀 PLAN DE IMPLEMENTACIÓN**

### **Semana 1: Arquitectura**
- Implementar estructura de datos base
- Crear utilidades DOM fundamentales
- Setup del sistema de eventos

### **Semana 2: UI Básica**
- Desarrollar menú rápido
- Implementar panel de detalles
- Crear estilos base

### **Semana 3: Funcionalidad Core**
- Sistema de persistencia
- Gestión XPath
- Anotaciones básicas (highlight/underline)

### **Semana 4: Características Avanzadas**
- Anotaciones anidadas
- Atajos de teclado
- Exportar/Importar

### **Semana 5: Pulimento**
- Testing y debugging
- Optimización de rendimiento
- Documentación

---

## **📝 NOTAS TÉCNICAS**

### **Compatibilidad del Navegador**
- ✅ Chrome/Edge 88+
- ✅ Firefox 85+
- ✅ Safari 14+
- ⚠️ IE: No soportado

### **Dependencias Externas**
- ❌ Sin dependencias externas
- ✅ Solo APIs nativas del navegador
- ✅ Compatible con Content Security Policy

### **Limitaciones Conocidas**
- 📄 PDFs embebidos: Soporte limitado
- 🔒 iFrames cross-origin: No soportado
- 📱 Touch devices: Requiere adaptación

### **Consideraciones de Seguridad**
- 🔐 Datos almacenados localmente
- 🚫 Sin transmisión de datos externos
- ✅ Sanitización de input del usuario
- 🛡️ Protección contra XSS

---

*Esta hoja de desarrollo servirá como guía completa para la implementación del sistema de anotaciones web inspirado en Zotero. Cada fase debe completarse antes de proceder a la siguiente para garantizar una base sólida.*

# 📚 Kit de librerías recomendado para tu Highlighter Tamper-monkey

## 1. Posicionamiento de menús flotantes
- **Floating UI** – cálculo preciso de pop-ups, flip, overflow, mobile-friendly.  
- **Tippy.js** – capa de conveniencia sobre Floating UI con API declarativa y animaciones.

## 2. Selección y manipulación de rangos
- **Rangy** – normaliza `Range`/`Selection` y facilita dividir/combinar nodos (clave para anidaciones).  
- **mark.js** – motor de resaltado/subrayado que envuelve texto con `<mark>` o `<span>` y lo des-resalta fácilmente.

## 3. Persistencia local (sin backend)
- **idb-keyval** – wrapper minimalista para IndexedDB (`get/set` atómico).  
- **Dexie.js** – capa tipo SQL sobre IndexedDB con migraciones y *live-queries*.

## 4. Utilidades de apoyo
- **nanoid** – generación de IDs únicos y seguros (< 1 kB).  
- **hotkeys-js** – captura de atajos complejos (`Ctrl + Shift + H`, etc.).  
- **Zustand** *o* **Signal-Simple** – estado global ligero sin framework.  
- **Emittery** – `EventEmitter` moderno y sin dependencias.

## 5. Tests y calidad
- **Vitest** – test runner ultrarrápido, compatible con Jest y ESM.  
- **Playwright** – E2E en Chrome/Firefox/WebKit; perfecto para validar selección y pop-ups.

## 6. Build y empaquetado
- **Vite** + *Userscript plugin* – empaqueta módulos y añade cabeceras `@grant/@require`.  
- **jsDelivr CDN** – importa las librerías anteriores en modo ESM (`https://cdn.jsdelivr.net/npm/.../+esm`).

---

### 🛠️ Stack mínimo sugerido

Floating UI → posicionamiento
Tippy.js → UI de pop-ups
Rangy → rangos de texto
nanoid → IDs únicos
idb-keyval → persistencia local
hotkeys-js → atajos de teclado
Vitest + Playwright → testing