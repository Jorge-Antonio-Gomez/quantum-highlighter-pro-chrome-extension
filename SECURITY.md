# Security Policy

The security of Quantum Highlighter PRO is a top priority. We appreciate the efforts of security researchers and the community to help keep our extension safe for everyone.

## Supported Versions

Security updates are applied only to the **latest version** of the extension available on the Chrome Web Store. We encourage all users to keep their extensions updated to ensure they have the latest security patches and features.

| Version | Supported          |
| :------- | :------------------ |
| The latest version on the Chrome Web Store | :white_check_mark: |
| All previous versions   | :x:                |

## Reporting a Vulnerability

We take all security reports seriously. If you believe you have found a security vulnerability in Quantum Highlighter PRO, please report it to us privately to protect our users.

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

1.  **Primary Method (Recommended):** Please use GitHub's private vulnerability reporting feature. You can do this by navigating to the "Security" tab of our repository and clicking on "Report a vulnerability". This is the most secure and efficient way to reach us.
    *   [**Report a vulnerability here**](https://github.com/Jorge-Antonio-Gomez/quantum-highlighter-pro-chrome-extension/security/advisories/new)

2.  **Alternate Method:** If you are unable to use GitHub's private reporting feature, you can send an email with the full details. Please contact `goga.jorge.antonio@gmail.com` with the subject line "Security Vulnerability Report: Quantum Highlighter PRO".

### What to Include

To help us resolve the issue quickly, please include the following in your report:

*   A clear and concise description of the vulnerability.
*   The version of the extension you are using.
*   Steps to reproduce the vulnerability, including any URLs or specific configurations if applicable.
*   Proof-of-concept code, screenshots, or videos that demonstrate the vulnerability.
*   Your assessment of the potential impact of the vulnerability.

### Our Commitment

*   We will strive to acknowledge your report within **48 hours**.
*   We will keep you informed of our progress as we investigate and work to resolve the issue.
*   We will provide a public advisory and credit you for your discovery (unless you prefer to remain anonymous) once the vulnerability has been patched and a new version has been released.

Thank you for helping to keep Quantum Highlighter PRO secure.

## Security Design

A short summary of the measures built into the extension, so reviewers and researchers know where to look:

*   **No remote code (Manifest V3):** every script ships inside the package; nothing is fetched, injected from strings, or evaluated at runtime. Third-party libraries (Tiptap, Floating UI, approx-string-match) are vendored in `libs/` in readable, non-obfuscated form.
*   **Minimal permissions:** no `tabs` permission and no broad host permissions beyond the content scripts; the only host permission is `https://www.googleapis.com/*`, used solely by the opt-in Google Drive sync. See [Permissions and Data Usage](PERSMISSIONS_AND_DATA_USAGE.md).
*   **Sign-in handled by Chrome:** the Drive sync uses `chrome.identity` with the `drive.appdata` scope only. The extension never sees passwords, keeps no long-lived secrets, and drops the cached token on disconnect. The service worker is the only component that holds the token.
*   **Encrypted transport:** all Drive traffic goes over HTTPS directly between the browser and Google; there is no developer server in between.
*   **Isolation on web pages:** the in-page menu lives in a shadow DOM and the sidebar in an extension iframe, so page scripts cannot reach them. Links in comments open with `noopener noreferrer`.
*   **Sanitized rendering:** the *All annotations* panel renders comments through an allow-list sanitizer (tags and safe `href` schemes only) before inserting them into the page.
*   **No data collection:** no analytics, telemetry, or crash reporting, which also means there is nothing to leak. Details in the [Privacy Policy](PRIVACY_POLICY.md).

---
## Related Documents

- **[README](README.md)**
- **[Privacy Policy](PRIVACY_POLICY.md)**
- **[Permissions and Data Usage](PERSMISSIONS_AND_DATA_USAGE.md)**