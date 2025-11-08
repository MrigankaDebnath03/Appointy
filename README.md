## Screenshots

<img width="860" height="992" alt="image" src="https://github.com/user-attachments/assets/7a65a1b5-4076-47a0-b6e7-b2ac7ee592f8" />
<img width="860" height="992" alt="image" src="https://github.com/user-attachments/assets/82490924-b2b7-4973-af60-55d5b710290f" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/ccf380aa-a447-4543-8182-57d237b5d6cb" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/20ea01b2-30e2-4302-a295-42ce0f5549ca" />

# Appointy — Project Synapse

A lightweight browser extension for capturing webpage screenshots and metadata, summarizing content, and performing semantic search across saved captures using the Mistral AI API.

This repository contains the extension source in the `extension/` folder (manifest, popup, background worker, content scripts, styling, and minor client-side logic). The extension stores captures locally and uses Mistral AI for text summarization, image analysis and embeddings-driven semantic search.

---

## Quick facts

- Platform: Browser extension (Chrome / Edge / Chromium-based)
- Where the code lives: `extension/`
- Main purpose: Capture page data + screenshot, summarize content with Mistral AI, store locally, and support semantic search over captures

---

## Prerequisites

- A Chromium-based browser (Chrome, Edge, Brave, etc.)
- Git
- (Optional) A Mistral AI API key for summarization, image analysis, and embeddings. Without this key, the extension can still capture screenshots and store them locally, but LLM features and semantic search will not work.

Notes about the Mistral API key
- This project currently contains example code that expects a Mistral API key in some files. For security, DO NOT commit your real API key into the repository or push it to a public remote.
- Recommended approach: use a local proxy to inject the key, or keep the key in a developer-only file that is ignored by git. See the "Configure the Mistral API key" section.

---

## Folder structure (top-level)

- `extension/` — the browser extension source
  - `manifest.json` — extension manifest and permissions
  - `popup.html`, `popup.js` — UI shown when clicking the extension icon
  - `background.js` — background worker (handles summarization and other long-running tasks)
  - `contentScript.js` — in-page capture script
  - `capture.js` — page capture helper (if present)
  - `db.js` — local DB and embedding calls
  - `semantic-search.js` — client-side semantic search utilities
  - `styles.css` — UI styling
  - `icons/` — extension icons
  - `README.md` — this file (project root)

---

## Running locally (Windows, pwsh)

1. Clone the repository

```powershell
git clone https://github.com/MrigankaDebnath03/Appointy.git
cd Appointy
```

2. Inspect the extension folder

Open `d:\PLACEMENT\APPOINTY\project-synapse\extension` (or your cloned folder) in your editor to review files.

3. Configure the Mistral API key (required for LLM features)

This repository currently contains hard-coded Mistral API key placeholders in several files (`background.js`, `db.js`, `semantic-search.js`). Before using the AI features, you must replace these values with your own key or configure a safer injection approach.

Two recommended ways:

A) Quick and simple (developer-only)
- Open `extension/background.js`, `extension/db.js`, and `extension/semantic-search.js` in your editor.
- Find any lines that look like:

```js
const MISTRAL_API_KEY = 'VGcaKfOvW...';
```

- Replace the string with your Mistral API key (e.g., `'sk_your_real_key_here'`) for local testing.
- IMPORTANT: Do not commit or push the updated files with the real key. Add any file you modify that contains the real key to `.gitignore` or revert before committing.

B) Safer: run a tiny local proxy/service that injects the API key
- Build a small local server that proxies requests to the Mistral API and adds the Authorization header server-side.
- Point the extension's Mistral API URL constants to `http://localhost:PORT/your-proxy-endpoint`.
This keeps your API key out of client-side code and source control.

4. Load the extension into Chrome/Edge (developer mode)

- Open your Chromium browser and go to `chrome://extensions/` (or `edge://extensions/`).
- Toggle "Developer mode" on (top-right).
- Click "Load unpacked" and select the `extension/` folder inside the repository.
- The extension should appear in the toolbar; click it to open the popup.

5. Capture a page and test features

- Click the extension icon to open the popup, use the UI to capture a screenshot or page content.
- If you configured Mistral API correctly, features like "Generate summary", "Analyze image", and semantic search will work (they trigger background fetch calls to the Mistral endpoints).
- If you don't supply a valid key, those features will fail with a network/authorization error — local capture/storage will still function.

---

## Notes about security and production

- Browser extensions run in the client environment: any API key in client-side JS is visible to end users. For production/public distribution, do NOT embed the key directly. Use a server-side proxy or serverless function to keep secrets private.
- If you plan to publish this extension, ensure any secret is moved server-side and the extension instead authenticates or calls your backend.

---

## Troubleshooting

- If summaries fail with a 401 or 403 error: the API key is invalid or missing. Double-check your key and whether you're hitting the correct Mistral endpoint.
- If the extension UI doesn't load: confirm `manifest.json` has the right fields and the extension folder you loaded contains `manifest.json` at its root.
- If screenshots aren't captured: check that `contentScript.js` is injected with the right host permissions in `manifest.json`.

---

## Development tips

- Iterating faster: after loading the unpacked extension, you can edit files in the `extension/` folder and click the reload icon on the extension card in `chrome://extensions/` to apply changes.
- Logging: open DevTools on the popup (right-click the popup or open the background page console in the extensions page) to view console logs and errors.

---

## Contribution

Contributions are welcome. If you want to add features (like secure key storage or a backend proxy), please open an issue or PR.

Guidelines:
- Don't commit secrets.
- Add tests or manual test steps for new features when possible.

---

## License

This project does not include a license file. If you want to open source it, add a LICENSE (for example MIT) and document usage rights.

---

## Summary

- To run locally: clone -> (optionally configure Mistral key) -> load `extension/` as an unpacked extension in Chrome/Edge.
- For secure, production-ready deployments, move the API key server-side and have the extension call your backend.

 ## Video Explanation( Google Drive Link)

- Google Drive Link -> https://drive.google.com/file/d/1ACUNceLobhkz1vtCzxO4O98QJVRtxs4O/view?usp=sharing



