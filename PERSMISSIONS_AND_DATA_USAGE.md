# Quantum Highlighter PRO: Permissions and Data Usage

This document provides a transparent overview of why Quantum Highlighter PRO requires certain permissions and what data it handles to function.

## 1. Single Purpose of the Extension

The extension is a web annotation system that allows users to highlight and underline text on any webpage. Users can add rich-text comments to their highlights, which are saved locally and managed through a sidebar. The purpose is to offer a tool for users to save and organize important snippets of information directly on the pages they visit, without relying on external services.

---

## 2. Permissions Justification

To achieve its purpose, the extension requires the following permissions:

*   **`storage`:** This permission is essential for the core functionality. It is used exclusively to store data on the user's device, including their annotations (highlights and notes), extension settings, and the list of sites where the user has disabled the extension. No data is ever sent to an external server.

*   **`activeTab`:** This permission allows the user to interact with the extension's icon in the Chrome toolbar. When clicked, it signals the currently active page to open or close the annotation sidebar. This ensures the extension only acts on the page the user is viewing and only upon their explicit action.

*   **`scripting`:** This is the central permission for the extension. It is required to inject the necessary JavaScript code into webpages. This code is responsible for detecting text selections, displaying the highlighter menu, applying visual styles for highlights, and managing the sidebar. Without it, creating and viewing annotations would be impossible.

*   **Host Permission (`*://*/*`):** This permission is requested to fulfill the promise of being a universal annotation tool. It allows the extension to work on any website the user visits, such as news articles, blogs, or research sites. The extension remains inactive until the user initiates an action (e.g., selecting text), ensuring it only runs when needed.

---

## 3. Data Usage

The extension handles the following types of user data, all of which are stored locally on the user's device and are never transmitted externally.

*   **User Activity:**
    *   **What is handled:** The extension responds to user actions like mouse clicks, text selection, and keyboard shortcuts.
    *   **Why it's handled:** This is necessary for the extension to be interactive. For example, it needs to know when a user has finished selecting text to show the highlighter menu, or when a user clicks a button to save a note. This activity is processed in real-time and is not logged or analyzed.

*   **Website Content:**
    *   **What is handled:** The extension saves the text content that the user specifically selects from a webpage.
    *   **Why it's handled:** This is the core of an annotation. The selected text is saved so it can be displayed as a highlight and stored alongside any associated notes in the sidebar.

---

## 4. Privacy Policy

For a complete and detailed explanation of our data handling practices, please see our full **[Privacy Policy](PRIVACY_POLICY.md)**.

---

## 5. Related Documents

- **[README](README.md)**
- **[Security Policy](SECURITY.md)**
