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
| `identity` | Used exclusively for the optional Google Drive sync. The extension calls chrome.identity.getAuthToken interactively only after the user clicks "Connect Google Drive" in the sidebar settings and confirms an explanatory dialog; no sign-in prompt is ever started on its own. The OAuth scope is limited to https://www.googleapis.com/auth/drive.appdata, so the extension can read and write only its own hidden application-data folder and never any other file in the user's Drive. The token is used solely to store the user's annotations as JSON files in that folder over HTTPS; it is never sent anywhere else, and the extension never sees the user's password. If the user never connects Google Drive, this permission is never exercised. Disconnecting removes the cached token. |
| `alarms` | Used only by the optional Google Drive sync to make uploads reliable in a Manifest V3 service worker, which is suspended after a few seconds of inactivity. When an annotation cannot be uploaded right away (for example, it was created offline or the Drive API returned a rate-limit error), the operation is kept in a local queue and a single alarm wakes the service worker to retry it, with exponential backoff for rate limits. The alarm carries no user data, does not touch any web page, and is cleared as soon as the queue is empty, when the user disconnects Google Drive, or when the Google authorization is no longer valid. It is never created if the user has not connected Google Drive. |
| `contextMenus` | Adds exactly one item, "View all my annotations", to the right-click menu of the extension's own toolbar icon (contexts: ["action"]). Clicking it opens the extension's bundled annotations page (annotations.html), which lists the user's saved annotations from all sites. No items are added to the context menu of web pages, selected text, links or images, and the permission is not used for anything else. |
| `favicon` | Used by the extension's own "All annotations" page to show the icon of each annotated website next to its title, so users can recognize pages at a glance. Icons are loaded through Chrome's built-in Favicon API (chrome-extension://<id>/_favicon/), which serves them from Chrome's local favicon cache. This causes no network requests by the extension, sends nothing to the developer or to any third-party favicon service, and does not read browsing history; if an icon is not cached, a generic placeholder is shown. The permission is purely cosmetic and is not used anywhere else. |
| Host permission `https://www.googleapis.com/*` | Calls the Google Drive API to read and write the extension's own files in the user's hidden app-data folder, only while the user is signed in to the optional sync. No other host is contacted. |
| Content scripts on `*://*/*` | The extension is a universal annotation tool: the content script draws the user's highlights on any page the user annotates and shows the highlighter menu when text is selected. It stays idle until the user acts and can be disabled per page or per site. |

**Are you using remote code?**

```
No. All code ships inside the package. Third-party libraries (Tiptap, Floating UI, approx-string-match) are vendored in readable form in /libs. The only network requests are Google Drive API calls, made solely after the user opts in to the optional sync.
```

**Data usage: qué marcar**

- **Website content** (marcar): texto seleccionado por el usuario y su contexto, dirección y título de la página anotada.
- **User activity** (marcar): interacciones con la extensión (selecciones, clics, atajos), procesadas en tiempo real y sin registro.
- **Personally identifiable information** (marcar desde 2026.0905.2): el correo de la cuenta de Google conectada a la sincronización opcional con Drive, leído de la API de Drive y guardado solo en el dispositivo para mostrar qué cuenta sincroniza. La FAQ de la tienda exige declarar los datos aunque solo se procesen o guarden localmente.
- No marcar: health, financial and payment, authentication (el token OAuth lo gestiona Chrome y la extensión no lo persiste), personal communications, location, web history (solo se guardan las páginas donde el usuario anotó, no las visitadas).

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

1. `manifest.json` con versión `2026.0905.2`. Respecto a la última versión publicada (2025.0802.1, solo `storage` y `activeTab`) son nuevos `identity`, `alarms`, `contextMenus`, `favicon` y el host permission de `googleapis.com`: al subir el paquete, la tienda pide justificar cada uno con los textos de la sección 2.
2. Subir `chrome_extension/chrome_extension.zip` generado desde la carpeta `chrome_extension` sin `TODO.md`, `mock-test-page.html`, `SETUP-GOOGLE-CLOUD.md`, `.claude/` ni el zip anterior.
3. Pegar los textos de las secciones 1 y 2, marcar las certificaciones y comprobar la URL de la política de privacidad.
4. Revisar la declaración Trader / Non-trader.
5. Tras la publicación, crear el tag `v2026.0905.2` si no existe y anotar la fecha en la tabla de Release Notes del README.
