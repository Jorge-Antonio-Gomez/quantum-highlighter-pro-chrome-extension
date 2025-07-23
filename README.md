# Quantum Highlighter PRO

Una extensión de navegador web completa que permite resaltar, anotar y gestionar comentarios en cualquier página web, inspirada en el sistema de anotaciones de Zotero. Disponible como extensión de Chrome con barra lateral integrada.

## Características principales

### 🎨 Sistema de Anotaciones Avanzado
*   **Dos tipos de anotación:** Resalta texto con un color de fondo o subráyalo.
*   **Ocho colores disponibles:** Personaliza tus notas con una paleta de 8 colores (amarillo, rojo, verde, azul, morado, rosa, naranja, gris).
*   **Editor de texto enriquecido:** Integración completa con Tiptap para comentarios con formato rico (negrita, cursiva, enlaces, listas, código, etc.).

### 📝 Gestión de Comentarios
*   **Comentarios enriquecidos:** Agrega comentarios con formato completo usando un editor WYSIWYG.
*   **Toolbar de formato:** Herramientas completas para formatear texto (negrita, cursiva, tachado, enlaces, bloques de código, citas, etc.).
*   **Placeholders dinámicos:** Textos de ayuda contextuales según el tipo de contenido que estés escribiendo.

### 🔧 Barra Lateral Inteligente
*   **Panel lateral dedicado:** Interfaz completa para gestionar todas tus anotaciones.
*   **Ancho ajustable:** Redimensiona la barra lateral arrastrando desde el borde y bloquea/desbloquea el ancho.
*   **Navegación por anotaciones:** Ve todas tus anotaciones organizadas por página.
*   **Estados vacíos informativos:** Mensajes útiles cuando no hay anotaciones disponibles.

### ⚙️ Configuración Avanzada
*   **Control granular:** Desactiva la extensión por página específica o sitio web completo.
*   **Forzado de color:** Opción para forzar texto negro en resaltados para mejor legibilidad.
*   **Gestión de idioma:** Cambia el idioma de la interfaz desde la configuración.
*   **Persistencia inteligente:** Las configuraciones se mantienen entre sesiones.

### 🌍 Internacionalización Completa
*   **Soporte multi-idioma:** Interfaz completamente traducida en 6 idiomas: español, inglés, francés, portugués, ruso y chino.
*   **Placeholders localizados:** Todos los textos de ayuda están adaptados culturalmente.
*   **Términos técnicos precisos:** Traducciones profesionales de toda la terminología técnica.

### ⌨️ Experiencia de Usuario Optimizada
*   **Atajos de teclado inteligentes:**
    *   `Esc`: Cierra menús o cancela la selección actual.
    *   `Supr`: Elimina la anotación seleccionada.
*   **Manejo contextual:** Los atajos se desactivan automáticamente en campos de texto.
*   **Selección precisa:** Recorta automáticamente espacios en blanco para mantener las notas limpias.
*   **Menú contextual mejorado:** Posicionamiento inteligente que evita salirse de la pantalla.

## Instalación

### Desde Chrome Web Store (Recomendado)
*Próximamente disponible en Chrome Web Store*

### Instalación Manual
1.  **Descarga la extensión:** Descarga o clona este repositorio.
2.  **Abre Chrome:** Ve a `chrome://extensions/` en tu navegador.
3.  **Modo desarrollador:** Activa el "Modo de desarrollador" en la esquina superior derecha.
4.  **Carga la extensión:** Haz clic en "Cargar extensión sin empaquetar" y selecciona la carpeta `chrome_extension`.
5.  **¡Listo!** La extensión aparecerá en tu barra de herramientas.

### Para Desarrolladores - UserScript
Si prefieres usar la versión UserScript original, necesitas una extensión que gestione scripts de usuario:

*   [Tampermonkey](https://www.tampermonkey.net/) (recomendado)
*   [Greasemonkey](https://www.greasespot.net/)
*   [Violentmonkey](https://violentmonkey.github.io/)

Luego instala el archivo `script_v2.js` desde el repositorio.

## Uso

### Creando Anotaciones
1.  **Selecciona texto:** Arrastra el ratón sobre el texto que quieres anotar en cualquier página web.
2.  **Elige el tipo:** Aparecerá un menú flotante donde puedes elegir entre resaltado o subrayado.
3.  **Selecciona color:** Elige uno de los 8 colores disponibles.
4.  **Agrega comentario:** Opcionalmente, haz clic en "Añadir comentario" para incluir notas detalladas.

### Editando Comentarios
1.  **Editor enriquecido:** Usa la barra de herramientas para formatear tu texto con:
    *   **Negrita, cursiva, tachado**
    *   **Enlaces con texto personalizable**
    *   **Listas y elementos estructurados**
    *   **Bloques de código y citas**
    *   **Encabezados de diferentes niveles**
2.  **Guarda o cancela:** Usa los botones para confirmar o descartar cambios.

### Gestión desde la Barra Lateral
1.  **Abre la barra lateral:** Haz clic en el icono de la extensión o usa el menú contextual.
2.  **Navega tus anotaciones:** Ve todas las anotaciones organizadas por página.
3.  **Edita o elimina:** Haz clic en cualquier anotación para editarla o eliminarla.
4.  **Ajusta el ancho:** Arrastra el borde izquierdo para redimensionar y usa el candado para fijar el tamaño.

### Configuración Avanzada
1.  **Accede a configuración:** Haz clic en el icono de engranaje en la barra lateral.
2.  **Cambia idioma:** Selecciona tu idioma preferido.
3.  **Controla visibilidad:** Desactiva la extensión en páginas específicas o sitios completos.
4.  **Optimiza legibilidad:** Activa el forzado de texto negro en resaltados.

## Configuración

### Cambio de Idioma
1.  **Desde la barra lateral:** Haz clic en el icono de configuración (⚙️).
2.  **Selecciona idioma:** Elige entre los idiomas disponibles:
    *   🇪🇸 **Español** (`es`)
    *   🇺🇸 **English** (`en`)
    *   🇫🇷 **Français** (`fr`)
    *   🇧🇷 **Português** (`pt`)
    *   🇷🇺 **Русский** (`ru`)
    *   🇨🇳 **中文** (`zh`)
3.  **Aplicación automática:** Los cambios se aplican inmediatamente sin necesidad de recargar.

### Opciones de Privacidad
*   **Desactivar en página:** Desactiva Quantum Highlighter solo en la página actual.
*   **Desactivar en sitio:** Desactiva la extensión en todo el dominio del sitio web.
*   **Gestión granular:** Las configuraciones se recuerdan automáticamente.

### Optimización Visual
*   **Forzar texto negro:** Mejora la legibilidad forzando el color negro en texto resaltado.
*   **Ancho de barra lateral:** Personaliza y fija el ancho según tus preferencias.
*   **Tema adaptable:** La interfaz se adapta automáticamente al tema del navegador.

## Arquitectura y Desarrollo

### Tecnologías Principales
*   **Extensión Chrome Manifest V3:** Implementación moderna y segura.
*   **Tiptap Editor:** Editor de texto enriquecido para comentarios avanzados.
*   **Floating UI:** Posicionamiento inteligente de menús contextuales.
*   **Sistema i18n personalizado:** Internacionalización completa sin dependencias externas.

### Estructura del Proyecto
```
chrome_extension/
├── manifest.json          # Configuración de la extensión
├── script.js              # Lógica principal de anotaciones
├── sidebar.js/.html/.css  # Interfaz de barra lateral
├── i18n.js                # Sistema de traducciones
├── background.js          # Service worker
├── style.css              # Estilos de anotaciones
└── libs/                  # Librerías externas
    ├── tiptap.js         # Editor de texto enriquecido
    └── floating-ui-*.js  # Posicionamiento de UI
```

### Componentes Principales
*   **`AnnotationManager`**: Gestión central de todas las anotaciones y su persistencia.
*   **`TiptapIntegration`**: Sistema de edición de texto enriquecido con toolbar completa.
*   **`SidebarController`**: Lógica de la barra lateral, redimensionamiento y configuración.
*   **`I18nSystem`**: Sistema de internacionalización con soporte para 6 idiomas.
*   **`StorageManager`**: Gestión inteligente de datos con Chrome Storage API.
*   **`ContextMenuManager`**: Menús contextuales con posicionamiento adaptativo.

### Características Técnicas
*   **Persistencia multiplataforma:** Usa Chrome Storage API para sincronización entre dispositivos.
*   **Rendimiento optimizado:** Lazy loading y gestión eficiente de memoria.
*   **Accesibilidad:** Soporte completo para lectores de pantalla y navegación por teclado.
*   **Responsive design:** Interfaz adaptable a diferentes tamaños de pantalla.
*   **Error handling:** Gestión robusta de errores con fallbacks automáticos.

## Versiones Disponibles

### 🚀 Extensión de Chrome (Recomendada)
*   **Interfaz completa** con barra lateral integrada
*   **Editor de texto enriquecido** con Tiptap
*   **Sincronización** entre dispositivos
*   **Configuración avanzada** desde la interfaz
*   **Actualizaciones automáticas**

### 📜 UserScript (Clásica)
*   **Versión ligera** para gestores de scripts
*   **Compatible** con Tampermonkey, Greasemonkey
*   **Funcionalidades básicas** de resaltado
*   **Ideal** para usuarios avanzados

## Contribución

¡Las contribuciones son bienvenidas! Por favor:

1.  **Fork** el repositorio
2.  **Crea** una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3.  **Commit** tus cambios (`git commit -am 'Agrega nueva característica'`)
4.  **Push** a la rama (`git push origin feature/nueva-caracteristica`)
5.  **Abre** un Pull Request

### Áreas de Contribución
*   🌍 **Traducciones** a nuevos idiomas
*   🎨 **Mejoras de UI/UX**
*   🐛 **Corrección de bugs**
*   📚 **Documentación**
*   ⚡ **Optimizaciones de rendimiento**

## Licencia

Este proyecto está bajo la Licencia Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0).

Puedes usar, modificar y distribuir libremente este software, siempre que mantengas la atribución original y compartas tus modificaciones bajo la misma licencia.

---

**Desarrollado con ❤️ por [Jorge Antonio Gómez](https://github.com/Jorge-Antonio-Gomez)**
