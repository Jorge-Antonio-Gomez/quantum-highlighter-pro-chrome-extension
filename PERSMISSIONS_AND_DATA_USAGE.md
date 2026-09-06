# Quantum Highlighter PRO: Permissions and Data Usage

This document provides a transparent overview of why Quantum Highlighter PRO requires certain permissions and what data it handles to function. It mirrors the declarations made in the **Privacy practices** tab of the Chrome Web Store Developer Dashboard, so that what reviewers and users read is the same.

**Applies to:** version 2026.0905.2 and later. **Last updated:** September 5, 2026.

---

## 1. Single Purpose of the Extension

The extension is a web annotation system that allows users to highlight and underline text on any webpage. Users can add rich-text comments to their highlights, which are saved in the browser's own storage and managed through a sidebar and through a full-page panel that lists every annotation across all websites. The purpose is to offer a tool for users to save and organize important snippets of information directly on the pages they visit, without relying on any developer-operated service. Optionally — and only if the user explicitly connects their account — annotations can be synced through a hidden, extension-private folder in the **user's own Google Drive**.

Every feature and every permission below serves that single purpose. The extension does not collect or use any data for other purposes.

---

## 2. Permissions Justification

To achieve its purpose, the extension requires the following permissions. This is the minimum set needed by the current feature set; none is requested "for future use".

*   **`storage`:** Essential for the core functionality. It stores the user's annotations (highlights, notes, and page notes), extension settings, and the list of sites where the user has disabled the extension. Unless the user explicitly connects the optional Google Drive sync (see `identity` below), no data ever leaves the browser's storage.

*   **`activeTab`:** Lets the extension react to a click on its toolbar icon. On a normal web page the click opens or closes the annotation sidebar; on pages where the sidebar cannot run (Chrome's internal pages, the Web Store, the PDF viewer) the click opens the extension's own *All annotations* panel instead. The extension only acts on the page the user is viewing and only upon their explicit action.

*   **Content scripts on all sites (`*://*/*`):** Requested to fulfill the promise of being a universal annotation tool. It allows the extension to work on any website the user visits, such as news articles, blogs, or research sites. The script stays idle until the user selects text or opens the sidebar, and it can be disabled per page or per site from the settings.

*   **`identity`:** Used exclusively for the **optional** Google Drive sync. When — and only when — the user clicks "Connect Google Drive" in the sidebar settings and confirms the explanatory dialog, this permission lets Chrome run the standard Google sign-in flow (OAuth 2.0) and hand the extension a temporary access token. The requested scope is strictly `https://www.googleapis.com/auth/drive.appdata`: the extension can only access its own hidden application-data folder, never the rest of the user's Drive files. The extension never sees the user's Google password, and if the user never connects, this permission is never exercised. Disconnecting invalidates the cached token.

*   **`alarms`:** Used only by the Google Drive sync to retry pending uploads in the background (for example, annotations created while offline are uploaded when the connection returns). The alarm merely wakes the extension's service worker on a schedule; it carries no user data and is removed as soon as there is nothing pending.

*   **`contextMenus`:** Adds a single entry, *View all my annotations*, to the right-click menu of the extension's toolbar icon. It only opens the extension's own annotations panel page; no entries are added to the context menu of web pages.

*   **`favicon`:** Lets the annotations panel show the favicon of each annotated page next to its title, using the icons Chrome already keeps in its local favicon cache. This is purely cosmetic and causes no network requests by the extension.

*   **Host Permission (`https://www.googleapis.com/*`):** Allows the extension to call the official Google Drive API — exclusively to read and write its own annotation files in the hidden app-data folder of the **user's own** Google Drive, and only while the user is signed in. No other host is ever contacted by the extension, and no request to this host is made if the user has not connected Google Drive.

---

## 3. Data Usage

The extension handles the following types of user data. Everything is stored on the user's device; the only exception is the optional Google Drive sync, which stores annotations in the user's own Google Drive account — never on any server operated by the developer. Nothing is sold, shared with, or transferred to third parties, and nothing is used for advertising, analytics, or profiling.

*   **User Activity:**
    *   **What is handled:** The extension responds to user actions like mouse clicks, text selection, and keyboard shortcuts.
    *   **Why it's handled:** This is necessary for the extension to be interactive. For example, it needs to know when a user has finished selecting text to show the highlighter menu, or when a user clicks a button to save a note. This activity is processed in real-time and is not logged or analyzed.

*   **Website Content:**
    *   **What is handled:** The extension saves the text content that the user specifically selects from a webpage, together with a few words of surrounding context and the position of the passage, plus the address of the page (without tracking parameters) and its title (trimmed to 120 characters). While the sidebar is open it also *displays* the page's title, description, favicon and preview image, read from the page's own tags and not stored.
    *   **Why it's handled:** This is the core of an annotation. The selected text is saved so it can be displayed as a highlight and stored alongside any associated notes; the context and position let the extension find the same passage again if the page changes; the address and title let the annotation reappear on the right page and be listed under a recognizable name in the sidebar and in the annotations panel.

*   **User-Generated Content:**
    *   **What is handled:** The rich-text comments the user writes on highlights, and the page notes created from the annotations panel.
    *   **Why it's handled:** Comments and page notes are the user's own annotations; storing them is the purpose of the extension.

*   **Settings and Counters:**
    *   **What is handled:** Sidebar width and lock state, dark mode and text-color options, the per-page and per-site disable lists (seeded with a small bundled list of sites where the extension is off by default), and a counter of created annotations.
    *   **Why it's handled:** To remember the user's preferences. The counter is used only to decide when to show the optional, dismissable "support the project" reminder, and the user can silence it permanently.

*   **Google Account Information (only if the user connects Google Drive):**
    *   **What is handled:** The email address of the Google Account the user chooses to connect.
    *   **Why it's handled:** It is stored locally on the device solely to show which account is connected in the settings panel. It is obtained *from* Google during sign-in and is never transmitted anywhere by the extension.

*   **Annotations in Google Drive (optional, off by default):**
    *   **What is handled:** If the user connects Google Drive, their annotations (selected text and context, notes, colors, the page address and title, and timestamps) are stored as JSON files — one per annotated page — in the extension's hidden application-data folder (`appDataFolder`) of the user's own Google Drive. Each file's metadata also carries a simple annotation count, used to display sync statistics without downloading content. Deletion markers are kept for up to 90 days so deletions propagate to the user's other devices, then purged.
    *   **Why it's handled:** To sync annotations across the user's devices without the ~100 KB limit of Chrome's built-in sync. That folder is accessible **only to this extension**: the developer has no access to the user's Drive or its contents, and data travels directly between the user's browser and Google's servers over HTTPS. Disconnecting saves a full local copy on the device and leaves the Drive data untouched; the user can delete it at any time from Google Drive's settings (*Manage apps*).

*   **Exports:**
    *   **What is handled:** On request, the annotations panel generates a Markdown or JSON file with the user's annotations, or copies them to the clipboard.
    *   **Why it's handled:** So the user can take their data anywhere. The file is created in the browser and saved by the browser on the device; nothing is uploaded.

*   **Payments:** The extension never handles payments or payment details. The optional "buy me a coffee" links open a Stripe-hosted payment page in a new tab, where the developer is identified as the seller. The only information passed to that page is the browser interface language.

### Chrome Web Store privacy practices declarations

These are the declarations made in the developer dashboard for this extension, kept here so they can be audited against the code:

| Declaration | Value |
| :--- | :--- |
| Data types handled | Website content (selected text and its context; address and title of pages the user annotates), user activity (interactions with the extension) and, only if the user connects the optional Google Drive sync, one item of personally identifiable information: the email address of the connected Google Account, kept on the device solely to show which account is syncing. No health, financial, authentication, location or communications data; no browsing history. |
| Data sold to third parties | Never. |
| Data used or transferred for purposes unrelated to the single purpose | Never. |
| Data used or transferred to determine creditworthiness or for lending | Never. |
| Remote code | None. All code ships inside the package; the only network requests are Google Drive API calls, made solely after the user opts in. |
| Data encryption in transit | All transfers (Google Drive only) use HTTPS. |

---

## 4. Remote Code

The extension does **not** execute remote code. All JavaScript is bundled inside the extension package and reviewed as part of each Chrome Web Store submission; nothing is loaded from external servers, injected from strings, or evaluated at runtime. Third-party libraries (Tiptap, Floating UI, an approximate string matcher) are vendored, unobfuscated, in the `libs/` folder. The only network requests the extension ever makes are the Google Drive API calls described above (data, not code), and only if the user has connected Google Drive. The favicons shown in the annotations panel come from Chrome's local cache, and the support links simply open a new tab.

---

## 5. Chrome Web Store compliance checklist

How the extension meets the Developer Program Policies in force since August 1, 2026. Reviewed on every release.

| Requirement | How it is met |
| :--- | :--- |
| Single purpose, narrow and easy to understand | Web annotation only (section 1). Sync, panel and export are ways to reach the same annotations. |
| Minimum permissions, each one justified | Section 2. No `tabs`, no broad host permissions beyond content scripts; Drive host permission limited to `googleapis.com`. |
| Privacy policy accessible from the store listing and inside the product | [PRIVACY_POLICY.md](PRIVACY_POLICY.md) is linked in the dashboard and from the extension's welcome page and README. |
| Data strictly necessary to the single purpose (Limited Use, 2026 update) | Only the data in section 3. No analytics, no telemetry, no identifiers. |
| Prominent disclosure and affirmative consent | The welcome page opens with a "How the extension handles your data" section and a **Got it** button. The same notice appears in the page at the first annotation, in the sidebar and in the panel until it is acknowledged (`disclosure.js`). The only transfer (Google Drive) is opt-in behind its own explanatory dialog, followed by Google's consent screen. |
| Disclosure of changes in data practices after installation (2026 update) | The service worker flags every update; if the user had not acknowledged the current practices version, the notice lists what changed. Documented in the privacy policy's change table and in [STORE_LISTING.md](STORE_LISTING.md) §3. |
| Secure transmission | HTTPS only, via Chrome's `identity` token; no credentials handled by the extension. |
| No remote code, readable code | Section 4; vendored libraries kept readable. |
| Honest monetization | Free extension; optional Stripe "buy me a coffee" links, seller identified on the payment page, never required for any feature, no affiliate links or codes. |
| No deceptive installation or notifications | Welcome page on first install only; support reminder is rare, dismissable and can be silenced permanently. |
| EU Digital Services Act trader declaration | Declared by the developer in the dashboard; the store shows the corresponding notice on the listing. |
| Version scheme accepted by the store | `YYYY.MMDD.N`, strictly increasing (e.g. 2026.0905.2). |

---

## 6. Privacy Policy

For a complete and detailed explanation of our data handling practices, please see our full **[Privacy Policy](PRIVACY_POLICY.md)**.

---

## 7. Related Documents

- **[README](README.md)**
- **[Security Policy](SECURITY.md)**
- **[Store listing texts](STORE_LISTING.md)**
