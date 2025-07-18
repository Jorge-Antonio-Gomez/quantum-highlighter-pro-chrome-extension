# 🌟 Resaltador de Páginas Web Avanzado

Un script de usuario avanzado para **Tampermonkey** que permite resaltar, subrayar y comentar texto en cualquier página web con una interfaz de usuario excepcional. Todos los datos se guardan localmente en tu navegador.

## ✨ Características

- 🎨 **Resaltado de texto** con 8 colores predefinidos
- ➖ **Subrayado de texto** personalizable
- 📝 **Comentarios** en el texto seleccionado
- 💾 **Almacenamiento local** - tus anotaciones se guardan automáticamente
- 🎯 **Interfaz intuitiva** con toolbox flotante
- 🔄 **Restauración automática** de anotaciones al recargar la página
- ✏️ **Edición y eliminación** de anotaciones existentes
- 🌐 **Compatible** con cualquier sitio web

## 🚀 Instalación

1. **Instala Tampermonkey** en tu navegador:
   - [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **Copia el script** desde `script_v1_gemini.js`

3. **Crea un nuevo script** en Tampermonkey y pega el código

4. **Guarda** y ¡listo para usar!

## 🎯 Cómo usar

### Resaltar texto
1. Selecciona cualquier texto en una página web
2. Aparecerá automáticamente una barra de herramientas flotante
3. Haz clic en **"H"** para resaltar con el color amarillo por defecto
4. O selecciona uno de los 8 colores disponibles en la paleta

### Subrayar texto
1. Selecciona el texto deseado
2. Haz clic en **"U"** en la barra de herramientas
3. El texto se subrayará con color rojo

### Añadir comentarios
1. Selecciona el texto
2. Haz clic en **"C"** para comentar
3. Escribe tu comentario en el modal que aparece
4. Haz clic en **"Guardar"**

### Editar o eliminar anotaciones
1. Haz clic en cualquier texto resaltado o subrayado
2. Se abrirá un modal donde puedes:
   - Editar el comentario existente
   - Eliminar la anotación completamente

## 🎨 Colores disponibles

El script incluye una paleta de 8 colores:
- 🟡 Amarillo (por defecto)
- 🔴 Rojo claro
- 🟢 Verde claro
- 🔵 Azul claro
- 🟣 Púrpura claro
- 🩷 Rosa claro
- 🟢 Verde agua
- 🩷 Rosa fuerte

## 💾 Almacenamiento de datos

- Las anotaciones se guardan automáticamente en el **localStorage** del navegador
- Los datos son específicos por dominio y ruta
- No se requiere conexión a internet para funcionar
- Los datos persisten entre sesiones del navegador

## 🔧 Características técnicas

- **Framework**: Vanilla JavaScript (sin dependencias)
- **Compatibilidad**: Todos los navegadores modernos
- **Almacenamiento**: localStorage del navegador
- **Selección robusta**: Sistema avanzado de detección y restauración de texto
- **UI/UX**: Interfaz moderna con transiciones suaves
- **Rendimiento**: Optimizado con debouncing y detección eficiente de cambios

## 📝 Estructura del proyecto

```
Highlighter WEB/
├── script_v1_gemini.js    # Script principal de Tampermonkey
├── ROADMAP.md            # Hoja de ruta del proyecto
├── README.md             # Este archivo
└── .gitignore           # Archivos ignorados por Git
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📋 Roadmap

Consulta el archivo `ROADMAP.md` para ver las características planificadas y el progreso del desarrollo.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

## 🐛 Reportar problemas

Si encuentras algún problema o tienes sugerencias, por favor [abre un issue](../../issues) en GitHub.

## 👤 Autor

**Gemini** - Desarrollo del script
**George** - Mantenimiento del repositorio

---

⭐ ¡Si te gusta este proyecto, no olvides darle una estrella en GitHub!
