# Privacy Policy for Quantum Highlighter PRO

**Last Updated:** July 8, 2026

Welcome to Quantum Highlighter PRO. Your privacy is a top priority for us. This policy outlines our data handling practices to help you understand how the extension operates and to assure you that your data is handled with the utmost care and transparency.

### Privacy at a Glance

*   **No Developer Servers, No Data Collection:** The extension has no servers of its own. We (the developer) never receive, see, or have access to any of your personal data or annotations.
*   **Your Data Stays Yours:** By default, all your data (highlights, notes, and settings) is stored in your own browser's secure storage. If you choose to enable the **optional Google Drive sync**, your annotations are stored in a hidden, extension-private folder of **your own Google Drive** — a space only this extension can access, and we cannot.
*   **You Are in Control:** You manage your own data. You can delete individual annotations, disconnect Google Drive at any time (a full copy is kept on your device), remove the extension's hidden data from your Drive, or revoke its access from your Google Account.
*   **No Third-Party Tracking:** There are no analytics or telemetry of any kind, and we do not sell or share your data with any third parties for marketing or any other purpose.

---

### 1. What Information the Extension Handles and Why

Quantum Highlighter PRO handles a minimal amount of data, which is essential for its functionality. This data is stored locally on your device and is never transmitted to us.

| Data Type | What It Is | Why It's Needed |
| :--- | :--- | :--- |
| **Website Content** | The specific text you select on a webpage to create a highlight or an underline. | This is the core of your annotation. The extension needs to save this text to display it in the sidebar and associate it with your notes. |
| **User-Generated Content** | The notes and comments you write for each of your highlights. These can include rich text formatting (like bold or links). | This allows you to add context and personal insights to your highlights, which is a key feature of the extension. |
| **Web Page URL** | The web address (URL) of the page where you create an annotation. | This is crucial for ensuring your highlights and notes automatically appear on the correct page when you revisit it. |
| **User Activity** | Direct interactions with the extension, such as mouse clicks to select text, menu choices, and keyboard shortcuts. | The extension needs to respond to these actions to function. For example, it detects a `mouseup` event to know when to show the highlighter menu. This activity is not logged or analyzed. |
| **Extension Settings** | Your preferences, such as the sidebar's width, color choices, or whether you've disabled the extension on a specific site. | This allows the extension to personalize your experience and remember your choices across different browsing sessions. |
| **Google Account Email** *(only if you connect the optional Google Drive sync)* | The email address of the Google Account you choose to connect. | It is shown in the settings panel so you always know which account is syncing. It is stored only on your device, obtained *from* Google during sign-in, and never transmitted to the developer or anyone else. |

**What We Explicitly DO NOT Collect:** We (the developer) do not collect any Personal Identifiable Information (PII) such as your name, email address, IP address, or location, nor any health or financial information. If you connect the optional Google Drive sync, sign-in is performed entirely by Chrome and Google (OAuth 2.0): the extension receives only a temporary access token managed by the browser and **never sees your Google password**. The token is used exclusively to talk to the Google Drive API and is invalidated when you disconnect.

### 2. How and Where Your Data is Stored

**By default (no sign-in required):** all data handled by Quantum Highlighter PRO is stored in your browser using the **`chrome.storage.sync`** and **`chrome.storage.local`** APIs.

*   **Local and Secure:** These are standard, secure storage solutions provided and managed by your web browser. The extension does not have its own database or servers.
*   **Browser Sync Feature:** If you are logged into your Google Account in your Chrome browser, Google may automatically sync the `chrome.storage.sync` data across your devices where you have the extension installed. This is a feature of the browser itself, and its privacy is governed by Google's Privacy Policy. We do not control this process.

**Optional Google Drive sync (opt-in):** if you explicitly connect your Google Account from the sidebar settings, your annotations are stored in the extension's hidden application-data folder (`appDataFolder`) of **your own Google Drive**, as one JSON file per annotated page containing the selected text, your notes, colors, the page URL, timestamps, and deletion markers.

*   **Strictly limited access:** the only OAuth scope requested is `drive.appdata`. The extension **cannot see, read, or modify any other file in your Drive**, and the hidden folder is accessible only to this extension — not to us, not to other apps.
*   **Direct connection:** your data travels exclusively between your browser and Google's servers over HTTPS. It never passes through any server of ours (we have none).
*   **While connected:** annotations are migrated from Chrome's sync storage to Drive (freeing its ~100 KB quota), and a small queue and cache in `chrome.storage.local` keep everything working while you are offline.
*   **When you disconnect:** a full copy of your annotations is saved back onto your device before signing out, and your data remains untouched in your Google Drive.

### 3. Data Retention and Deletion

You have full control over your data.
*   **Annotation Data (browser storage):** retained as long as you have the extension installed. You can delete individual annotations at any time, which removes them from storage.
*   **Annotation Data (Google Drive, if connected):** retained in your Drive until you delete it. Deleting an annotation in the extension also deletes it from Drive; a small deletion marker is kept for up to 90 days so the deletion reaches your other devices, and is then purged automatically.
*   **Deleting everything from Drive:** open Google Drive → **Settings → Manage apps → Quantum Highlighter PRO → Options → Delete hidden app data**. The extension tolerates this: it simply starts from an empty state.
*   **Revoking access:** you can revoke the extension's access to your Google Account at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). The extension will detect it and offer to reconnect, without any unsolicited sign-in prompts.
*   **Uninstalling:** if you uninstall the extension, your browser automatically deletes all locally stored data. **Data already synced to your Google Drive is not deleted automatically** — if you want it removed, use *Manage apps* as described above (before or after uninstalling).

### 4. Third-Party Services

Quantum Highlighter PRO does not use any third-party service for data processing on its own initiative.

**Google Drive API (optional, opt-in):** if you enable the Google Drive sync, the extension uses the official Google Drive API to store your annotations in your own Google account, acting solely on your behalf. That storage is governed by Google's Privacy Policy and Terms of Service. Quantum Highlighter PRO's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including its **Limited Use** requirements: the data is used only to provide the sync feature you requested, is never transferred to third parties, and is never used for advertising.

The extension also includes optional, user-initiated "buy me a coffee" links on its welcome page and within a modal. These are standard hyperlinks to a payment page hosted by Stripe. Clicking them navigates you away from the extension to that third-party website in a new tab. This Privacy Policy does not cover the data practices of those external sites. The only information the extension appends to the link is your browser interface language, so that the payment page is displayed in your language. No other data from the extension is shared with these sites.

### 5. Children's Privacy

This extension is intended for a general audience and is not directed at children under the age of 13. We do not knowingly collect any personal information from children.

### 6. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in the extension's functionality or to comply with new legal requirements. We will post the updated policy on this page and revise the "Last Updated" date. We encourage you to review this policy periodically.

### 7. Contact Us

If you have any questions, concerns, or suggestions regarding this Privacy Policy, please feel free to open an issue on our [GitHub repository](https://github.com/Jorge-Antonio-Gomez/quantum-highlighter-pro-chrome-extension).

---
### 8. Related Documents

- **[README](README.md)**
- **[Permissions and Data Usage](PERSMISSIONS_AND_DATA_USAGE.md)**
- **[Security Policy](SECURITY.md)**
