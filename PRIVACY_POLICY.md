# Privacy Policy for Quantum Highlighter PRO

**Last Updated:** September 5, 2026 (applies to version 2026.0905.2 and later)

Welcome to Quantum Highlighter PRO. Your privacy is a top priority for us. This policy outlines our data handling practices to help you understand how the extension operates and to assure you that your data is handled with the utmost care and transparency. It is written to meet the Chrome Web Store Developer Program Policies in force since August 1, 2026, including the **Limited Use** and **Disclosure Requirements** policies.

### Privacy at a Glance

*   **No Developer Servers, No Data Collection:** The extension has no servers of its own. We (the developer) never receive, see, or have access to any of your personal data or annotations. There are no analytics, telemetry, crash reports, or advertising identifiers of any kind.
*   **Your Data Stays Yours:** By default, everything (highlights, notes, page notes, and settings) is stored in your own browser's storage. If you choose to enable the **optional Google Drive sync**, your annotations are stored in a hidden, extension-private folder of **your own Google Drive** — a space only this extension can access, and we cannot.
*   **Everything Is Visible to You:** The sidebar shows the annotations of the current page, and the *All annotations* panel shows every annotation you have ever saved, across all sites. Both read the same storage described below; there is no hidden copy anywhere.
*   **You Are in Control:** You can edit or delete any annotation, export them all as Markdown or JSON, disconnect Google Drive at any time (a full copy is kept on your device), remove the extension's hidden data from your Drive, or revoke its access from your Google Account.
*   **Strictly Necessary Data Only:** The extension only handles the data needed for its single purpose — annotating web pages — and uses it for nothing else. We never sell, share, or transfer your data, and we never use it for advertising.

---

### 1. What Information the Extension Handles and Why

Quantum Highlighter PRO handles a minimal amount of data, all of which is essential for its functionality. Unless stated otherwise, this data is stored on your device (or, if you opt in, in your own Google Drive) and is never transmitted to us.

| Data Type | What It Is | Why It's Needed |
| :--- | :--- | :--- |
| **Website Content** | The specific text you select on a webpage to create a highlight or an underline, together with a short context around it (a few words before and after) and its position in the page. | This is the core of your annotation. The text is shown in the sidebar and the panel, and the context and position let the extension find the same passage again, even if the page changes slightly. |
| **Page Address and Title** | The address of the page you annotate (domain and path, without tracking parameters) and the page title, trimmed to 120 characters. | The address ties each annotation to its page so it reappears when you return. The title labels each page in the sidebar and in the panel so you can recognize it without opening it. |
| **User-Generated Content** | The notes and comments you write for each highlight, and the *page notes* you can create from the panel. These may include rich-text formatting (bold, lists, links). | This lets you add context and personal insights to your highlights, which is a key feature of the extension. |
| **User Activity** | Direct interactions with the extension: text selection, menu choices, clicks, and keyboard shortcuts. | The extension needs to respond to these actions to function, for example detecting when a selection ends to show the highlighter menu. This activity is processed in real time and is never logged or analyzed. |
| **Extension Settings** | Your preferences: sidebar width and lock state, dark mode, text-color options, the list of pages or sites where you disabled the extension (including a small bundled list of sites where the extension is off by default), and a counter of created annotations used only to decide when to show the optional "support the project" reminder. | These allow the extension to remember your choices across sessions and to keep that reminder rare and dismissable. |
| **Page Metadata (displayed only)** | While the sidebar is open, it shows the current page's title, description, favicon, and preview image, read from the page's own tags. | Purely for context in the sidebar. This metadata is **not stored**: it is read from the page you are viewing and discarded when you leave it. |
| **Google Account Email** *(only if you connect the optional Google Drive sync)* | The email address of the Google Account you choose to connect. | It is shown in the settings panel so you always know which account is syncing. It is stored only on your device, obtained *from* Google during sign-in, and never transmitted to the developer or anyone else. |

**What We Explicitly DO NOT Collect:** We (the developer) never receive any personally identifiable information such as your name, email address, IP address, or location, nor any health, financial, or authentication information, nor your browsing history. The only personal datum the extension itself handles is the email address of the Google Account you choose to connect to the optional Drive sync, and it stays on your device as described in the table above. The extension does not know which pages you visit: it only stores the addresses of pages where **you** deliberately created an annotation. If you connect the optional Google Drive sync, sign-in is performed entirely by Chrome and Google (OAuth 2.0): the extension receives only a temporary access token managed by the browser and **never sees your Google password**. The token is used exclusively to talk to the Google Drive API and is invalidated when you disconnect.

### 2. How and Where Your Data is Stored

**By default (no sign-in required):** all data handled by Quantum Highlighter PRO is stored in your browser using the **`chrome.storage.sync`** and **`chrome.storage.local`** APIs.

*   **Local and Secure:** These are standard, secure storage solutions provided and managed by your web browser. The extension does not have its own database or servers.
*   **Browser Sync Feature:** If you are logged into your Google Account in your Chrome browser, Google may automatically sync the `chrome.storage.sync` data across your devices where you have the extension installed. This is a feature of the browser itself, and its privacy is governed by Google's Privacy Policy. We do not control this process.

**Optional Google Drive sync (opt-in):** if you explicitly connect your Google Account from the sidebar settings, your annotations are stored in the extension's hidden application-data folder (`appDataFolder`) of **your own Google Drive**, as one JSON file per annotated page containing the selected text and its context, your notes, colors, the page address and title, timestamps, and deletion markers.

*   **Informed consent first:** before the Google sign-in window appears, the extension explains in its own interface what will be stored in your Drive and asks you to confirm. Nothing is sent to Drive until you complete that sign-in.
*   **Strictly limited access:** the only OAuth scope requested is `drive.appdata`. The extension **cannot see, read, or modify any other file in your Drive**, and the hidden folder is accessible only to this extension — not to us, not to other apps.
*   **Direct, encrypted connection:** your data travels exclusively between your browser and Google's servers over HTTPS. It never passes through any server of ours (we have none).
*   **While connected:** annotations are migrated from Chrome's sync storage to Drive (freeing its ~100 KB quota), and a small queue and cache in `chrome.storage.local` keep everything working while you are offline.
*   **When you disconnect:** a full copy of your annotations is saved back onto your device before signing out, and your data remains untouched in your Google Drive.

**Favicons in the panel:** the *All annotations* panel shows the icon of each annotated site using Chrome's own local favicon cache (the `favicon` permission). No request is sent to any website or to us for this.

### 3. Data Retention and Deletion

You have full control over your data.
*   **Annotation Data (browser storage):** retained as long as you have the extension installed. You can delete individual annotations, or every annotation of a page, from the sidebar or the panel at any time, which removes them from storage.
*   **Annotation Data (Google Drive, if connected):** retained in your Drive until you delete it. Deleting an annotation in the extension also deletes it from Drive; a small deletion marker is kept for up to 90 days so the deletion reaches your other devices, and is then purged automatically.
*   **Exports:** Markdown or JSON files you export from the panel are saved by your browser on your device only. They are never uploaded anywhere by the extension.
*   **Deleting everything from Drive:** open Google Drive → **Settings → Manage apps → Quantum Highlighter PRO → Options → Delete hidden app data**. The extension tolerates this: it simply starts from an empty state.
*   **Revoking access:** you can revoke the extension's access to your Google Account at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). The extension will detect it and offer to reconnect, without any unsolicited sign-in prompts.
*   **Uninstalling:** if you uninstall the extension, your browser automatically deletes all locally stored data. **Data already synced to your Google Drive is not deleted automatically** — if you want it removed, use *Manage apps* as described above (before or after uninstalling).

### 4. Third-Party Services and External Links

Quantum Highlighter PRO does not use any third-party service for data processing on its own initiative, and it never loads or executes code from the internet: everything it runs ships inside the extension package reviewed by the Chrome Web Store.

**Google Drive API (optional, opt-in):** if you enable the Google Drive sync, the extension uses the official Google Drive API to store your annotations in your own Google account, acting solely on your behalf. That storage is governed by Google's Privacy Policy and Terms of Service. Quantum Highlighter PRO's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including its **Limited Use** requirements: the data is used only to provide the sync feature you requested, is never transferred to third parties, and is never used for advertising.

**Support links (Stripe):** the welcome page and an occasional, dismissable reminder include optional "buy me a coffee" links. These are standard hyperlinks to a payment page hosted by Stripe, where you can buy a symbolic coffee (5 USD each) to support development. Clicking them opens that third-party website in a new tab; the extension itself never handles payments or payment details, and the seller shown on the payment page is the developer, not Google. This Privacy Policy does not cover the data practices of Stripe. The only information the extension appends to the link is your browser interface language, so that the payment page is displayed in your language. No other data from the extension is shared with Stripe.

**Links back to annotated pages:** when you open a page from the panel, the extension adds the quoted text to the address as a *text fragment* (`#:~:text=…`) so Chrome scrolls to the passage. Browsers do not send the fragment to the website's server; it stays in your address bar and browsing history like any other link you open.

**Page assets in the sidebar:** to show the current page's favicon and preview image, the sidebar loads those two images from the same website you are already visiting. No other site is contacted.

**GitHub:** the welcome page and the documentation link to the project's public repository. Opening those links is subject to GitHub's privacy policy.

### 5. Children's Privacy

This extension is intended for a general audience and is not directed at children under the age of 13. We do not knowingly collect any personal information from children.

### 6. Changes to This Privacy Policy and to Our Data Practices

We may update this Privacy Policy from time to time to reflect changes in the extension's functionality or to comply with new legal requirements. We will post the updated policy on this page and revise the "Last Updated" date.

In line with the Chrome Web Store Disclosure Requirements policy, the extension shows this information prominently inside the product, not only in this document: new users see it on the welcome page, and everyone sees a short notice the next time they annotate a page, open the sidebar or open the *All annotations* panel, until they acknowledge it with the **Got it** button. Whenever an update changes **what** data the extension handles or **where** it is stored, that notice also lists what changed. Recent changes of that kind:

| Version | Date | Change in data practices |
| :--- | :--- | :--- |
| 2026.0905.2 | September 5, 2026 | New annotations store the page title (trimmed). The *All annotations* panel reads all stored annotations and shows site favicons from Chrome's local cache. Support links now go to Stripe instead of PayPal. |
| 2026.0708.1 | July 8, 2026 | Optional, opt-in Google Drive sync (`drive.appdata` scope). Annotations store a short context and position for robust re-anchoring. |
| 2025.0802.1 | August 2, 2025 | Initial public release: local storage and Chrome's built-in sync only. |

### 7. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please open an issue on our [GitHub repository](https://github.com/Jorge-Antonio-Gomez/quantum-highlighter-pro-chrome-extension) or write to `goga.jorge.antonio@gmail.com`.

---
### 8. Related Documents

- **[README](README.md)**
- **[Permissions and Data Usage](PERSMISSIONS_AND_DATA_USAGE.md)**
- **[Security Policy](SECURITY.md)**
