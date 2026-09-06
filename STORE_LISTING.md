# Chrome Web Store: textos del Developer Dashboard

Textos listos para pegar en el Developer Dashboard de la Chrome Web Store para la versión **2026.0905.2**. Están en inglés porque es el idioma en que revisa el equipo de la tienda. Mantenerlos alineados con [PERSMISSIONS_AND_DATA_USAGE.md](PERSMISSIONS_AND_DATA_USAGE.md) y [PRIVACY_POLICY.md](PRIVACY_POLICY.md) en cada release.

---

## 1. Pestaña "Store listing"

**Summary (máx. 132 caracteres)**

```
Highlight, underline and annotate any web page with rich-text notes. Your data stays in your browser or your own Google Drive.
```

**Description**

```
Quantum Highlighter PRO lets you highlight and underline text on any web page, add rich-text comments, and find everything again later.

• Two annotation types (highlight and underline) and eight colors.
• Rich-text comments with bold, italics, links, lists, quotes and code.
• A sidebar with the annotations of the current page, and an "All annotations" panel with every annotation from every site: search, filters by color, type, site and date, page notes, and export to Markdown or JSON.
• Robust anchoring: highlights survive page changes and heal themselves.
• Six languages: English, Spanish, French, Portuguese (Brazil), Russian and Simplified Chinese.

YOUR DATA STAYS YOURS
Annotations are stored in your browser (Chrome may sync them with your Google account). Optionally, you can connect your own Google Drive: annotations are then kept in a hidden folder that only this extension can access, using the narrowest Drive scope (drive.appdata). Nothing is ever sent to the developer. No analytics, no ads, no data selling.

The extension is free and open source. It includes optional "buy me a coffee" links that open a Stripe payment page; no feature is ever locked behind them.

Privacy policy: https://github.com/Jorge-Antonio-Gomez/quantum-highlighter-pro-chrome-extension/blob/main/PRIVACY_POLICY.md
Source code: https://github.com/Jorge-Antonio-Gomez/quantum-highlighter-pro-chrome-extension
```

---

## 2. Pestaña "Privacy practices"

**Single purpose description**

```
Quantum Highlighter PRO has a single purpose: letting users highlight, underline and annotate text on web pages, and manage those annotations (sidebar for the current page, "All annotations" panel across sites, optional sync to the user's own Google Drive).
```

**Permission justifications**

| Permiso | Justificación |
| :--- | :--- |
| `storage` | Stores the user's annotations (highlighted text with a little context, page address and title, colors, comments and page notes), the extension settings, and the list of sites where the user disabled the extension. Nothing leaves the browser unless the user connects the optional Google Drive sync. |
| `activeTab` | Lets the toolbar icon act on the page the user is viewing: it opens or closes the annotation sidebar. On pages where the sidebar cannot run (Chrome internal pages, Web Store, PDF viewer) the click opens the extension's own "All annotations" page instead. |
| `identity` | Only for the optional Google Drive sync. After the user clicks "Connect Google Drive" and confirms an explanatory dialog, chrome.identity runs Google's standard OAuth flow with the single scope drive.appdata. The extension never sees the password and never uses this permission unless the user opts in. |
| `alarms` | Only for the optional Google Drive sync: retries pending uploads created while offline. The alarm carries no data and is cleared when nothing is pending. |
| `contextMenus` | Adds one entry, "View all my annotations", to the right-click menu of the extension's toolbar icon, to open the extension's own annotations page. No entries are added to web pages. |
| `favicon` | Shows the icon of each annotated site in the "All annotations" page from Chrome's local favicon cache. Cosmetic; no network requests. |
| Host permission `https://www.googleapis.com/*` | Calls the Google Drive API to read and write the extension's own files in the user's hidden app-data folder, only while the user is signed in to the optional sync. No other host is contacted. |
| Content scripts on `*://*/*` | The extension is a universal annotation tool: the content script draws the user's highlights on any page the user annotates and shows the highlighter menu when text is selected. It stays idle until the user acts and can be disabled per page or per site. |

**Are you using remote code?**

```
No. All code ships inside the package. Third-party libraries (Tiptap, Floating UI, approx-string-match) are vendored in readable form in /libs. The only network requests are Google Drive API calls, made solely after the user opts in to the optional sync.
```

**Data usage: qué marcar**

- **Website content** (marcar): texto seleccionado por el usuario y su contexto, dirección y título de la página anotada.
- **User activity** (marcar): interacciones con la extensión (selecciones, clics, atajos), procesadas en tiempo real y sin registro.
- No marcar: personally identifiable information, health, financial and payment, authentication, personal communications, location, web history.

Si el formulario muestra la taxonomía nueva (Web activity, App activity, Identifiers, Cookies, Contact information, Personal information, Financial information, Health and fitness, Messages, Location data): marcar únicamente **Web activity** con el uso "App functionality".

**Certificaciones (marcar las tres)**

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**

```
https://github.com/Jorge-Antonio-Gomez/quantum-highlighter-pro-chrome-extension/blob/main/PRIVACY_POLICY.md
```

---

## 3. Divulgación destacada dentro del producto (política vigente desde 2026-08-01)

La tienda exige aviso destacado y consentimiento afirmativo, además de avisar de los cambios tras la instalación. Cómo lo cumple la versión 2026.0905.2:

| Superficie | Qué se muestra | Cuándo |
| :--- | :--- | :--- |
| Página de bienvenida (`welcome.html`) | Sección "Cómo trata tus datos" con los cuatro puntos, enlace a la política y botón "Entendido" que registra la aceptación. | Al instalar. |
| Aviso en página (content script) | Modal con los mismos puntos; tras una actualización, además la lista "Qué ha cambiado". Solo "Entendido" registra la aceptación. | Al crear la primera anotación sin aceptación registrada. Tiene prioridad sobre el recordatorio de apoyo. |
| Sidebar | Mismo modal. | Al abrir el sidebar sin aceptación registrada. |
| Panel "Todas las anotaciones" | Mismo modal, más una nota permanente de privacidad con enlace a la política en la columna lateral. | Al abrir el panel sin aceptación registrada; la nota, siempre. |
| Service worker | En `onInstalled` con `reason: "update"` marca que hay que mostrar "qué cambió". | En cada actualización. |

La aceptación se guarda en `chrome.storage.sync` (`qhp-disclosure-ack`) con la **versión de prácticas** (`PRACTICES_VERSION` en `disclosure.js`). Solo hay que subirla cuando cambie qué se guarda o dónde; entonces se añade la lista de cambios en `CHANGES` y las claves i18n correspondientes en los seis idiomas.

---

## 4. Cuenta de desarrollador

- **Trader / Non-trader (Ley de Servicios Digitales de la UE):** hay que declararlo en el dashboard. Un desarrollador que publica una extensión gratuita a título personal y acepta aportaciones voluntarias ("invítame un café") normalmente no actúa "en el marco de una actividad comercial", pero la declaración es responsabilidad del desarrollador. Si se declara Trader, la ficha muestra públicamente nombre legal, dirección, correo y teléfono, y la tienda los verifica.
- **Verificación en dos pasos** activada en la cuenta de Google del dashboard (obligatoria para publicar).
- **Correo de contacto** verificado en la pestaña Account.

---

## 5. Checklist de publicación de 2026.0905.2

1. `manifest.json` con versión `2026.0905.2` y los permisos `contextMenus` y `favicon` nuevos: al subir el paquete, la tienda pedirá justificar los permisos nuevos con los textos de la sección 2.
2. Subir `chrome_extension/chrome_extension.zip` generado desde la carpeta `chrome_extension` sin `TODO.md`, `mock-test-page.html`, `SETUP-GOOGLE-CLOUD.md`, `.claude/` ni el zip anterior.
3. Pegar los textos de las secciones 1 y 2, marcar las certificaciones y comprobar la URL de la política de privacidad.
4. Revisar la declaración Trader / Non-trader.
5. Tras la publicación, crear el tag `v2026.0905.2` si no existe y anotar la fecha en la tabla de Release Notes del README.
