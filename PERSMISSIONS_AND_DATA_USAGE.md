# Quantum Highlighter PRO: Permissions and Data Usage

This document provides a transparent overview of why Quantum Highlighter PRO requires certain permissions and what data it handles to function.

## 1. Single Purpose of the Extension

The extension is a web annotation system that allows users to highlight and underline text on any webpage. Users can add rich-text comments to their highlights, which are saved in the browser's own storage and managed through a sidebar and through a full-page panel that lists every annotation across all websites. The purpose is to offer a tool for users to save and organize important snippets of information directly on the pages they visit, without relying on any developer-operated service. Optionally — and only if the user explicitly connects their account — annotations can be synced through a hidden, extension-private folder in the **user's own Google Drive**.

---

## 2. Permissions Justification

To achieve its purpose, the extension requires the following permissions:

*   **`storage`:** This permission is essential for the core functionality. It is used to store data on the user's device, including their annotations (highlights and notes), extension settings, and the list of sites where the user has disabled the extension. Unless the user explicitly connects the optional Google Drive sync (see `identity` below), no data ever leaves the browser's storage.

*   **`activeTab`:** This permission allows the user to interact with the extension's icon in the Chrome toolbar. When clicked, it signals the currently active page to open or close the annotation sidebar. This ensures the extension only acts on the page the user is viewing and only upon their explicit action.

*   **Host Permission (`*://*/*`):** This permission is requested to fulfill the promise of being a universal annotation tool. It allows the extension to work on any website the user visits, such as news articles, blogs, or research sites. The extension remains inactive until the user initiates an action (e.g., selecting text), ensuring it only runs when needed.

*   **`identity`:** Used exclusively for the **optional** Google Drive sync. When — and only when — the user clicks "Connect Google Drive" in the sidebar settings, this permission lets Chrome run the standard Google sign-in flow (OAuth 2.0) and hand the extension a temporary access token. The requested scope is strictly `https://www.googleapis.com/auth/drive.appdata`: the extension can only access its own hidden application-data folder, never the rest of the user's Drive files. The extension never sees the user's Google password, and if the user never connects, this permission is never exercised. Disconnecting invalidates the cached token.

*   **`alarms`:** Used only by the Google Drive sync to retry pending uploads in the background (for example, annotations created while offline are uploaded when the connection returns). The alarm merely wakes the extension's service worker on a schedule; it carries no user data and is removed as soon as there is nothing pending.

*   **`contextMenus`:** Adds a single entry, *View all my annotations*, to the right-click menu of the extension's toolbar icon. It only opens the extension's own annotations panel page; no entries are added to the context menu of web pages.

*   **`favicon`:** Lets the annotations panel show the favicon of each annotated page next to its title, using the icons Chrome already keeps in its local favicon cache. This is purely cosmetic and causes no network requests by the extension.

*   **Host Permission (`https://www.googleapis.com/*`):** Allows the extension to call the official Google Drive API — exclusively to read and write its own annotation files in the hidden app-data folder of the **user's own** Google Drive, and only while the user is signed in. No other host is ever contacted by the extension, and no request to this host is made if the user has not connected Google Drive.

---

## 3. Data Usage

The extension handles the following types of user data. Everything is stored on the user's device; the only exception is the optional Google Drive sync, which stores annotations in the user's own Google Drive account — never on any server operated by the developer.

*   **User Activity:**
    *   **What is handled:** The extension responds to user actions like mouse clicks, text selection, and keyboard shortcuts.
    *   **Why it's handled:** This is necessary for the extension to be interactive. For example, it needs to know when a user has finished selecting text to show the highlighter menu, or when a user clicks a button to save a note. This activity is processed in real-time and is not logged or analyzed.

*   **Website Content:**
    *   **What is handled:** The extension saves the text content that the user specifically selects from a webpage, together with the address of the page (without tracking parameters) and its title, so the annotation can be found again on that page and listed under it in the sidebar and the annotations panel.
    *   **Why it's handled:** This is the core of an annotation. The selected text is saved so it can be displayed as a highlight and stored alongside any associated notes in the sidebar.

*   **Google Account Information (only if the user connects Google Drive):**
    *   **What is handled:** The email address of the Google Account the user chooses to connect.
    *   **Why it's handled:** It is stored locally on the device solely to show which account is connected in the settings panel. It is obtained *from* Google during sign-in and is never transmitted anywhere by the extension.

*   **Annotations in Google Drive (optional, off by default):**
    *   **What is handled:** If the user connects Google Drive, their annotations (selected text, notes, colors, the page URL, and timestamps) are stored as JSON files — one per annotated page — in the extension's hidden application-data folder (`appDataFolder`) of the user's own Google Drive. Each file's metadata also carries a simple annotation count, used to display sync statistics without downloading content. Deletion markers are kept for up to 90 days so deletions propagate to the user's other devices, then purged.
    *   **Why it's handled:** To sync annotations across the user's devices without the ~100 KB limit of Chrome's built-in sync. That folder is accessible **only to this extension**: the developer has no access to the user's Drive or its contents, and data travels directly between the user's browser and Google's servers over HTTPS. Disconnecting saves a full local copy on the device and leaves the Drive data untouched; the user can delete it at any time from Google Drive's settings (*Manage apps*).

---

## 4. Remote Code

The extension does **not** execute remote code. All JavaScript is bundled inside the extension package and reviewed as part of each Chrome Web Store submission; nothing is loaded from external servers, injected from strings, or evaluated at runtime. The only network requests the extension ever makes are the Google Drive API calls described above (data, not code), and only if the user has connected Google Drive.

---

## 5. Privacy Policy

For a complete and detailed explanation of our data handling practices, please see our full **[Privacy Policy](PRIVACY_POLICY.md)**.

---

## 6. Related Documents

- **[README](README.md)**
- **[Security Policy](SECURITY.md)**
