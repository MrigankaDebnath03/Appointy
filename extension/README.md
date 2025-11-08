# Context Screenshot Saver (extension)

This Chrome/Edge-compatible Manifest V3 extension captures a visible screenshot and extracts page text when you press Alt+S. You can then add a short context note and a remainder time; the record is saved to a local IndexedDB database and viewable from the extension popup.

Files added:
- `manifest.json` — extension manifest (MV3).
- `background.js` — service worker handling the Alt+S command and capture.
- `contentScript.js` — extracts page text and title.
- `capture.html` / `capture.js` — small UI to preview screenshot, edit context and save to DB.
- `popup.html` / `popup.js` — view saved contexts in cards, open details and delete.
- `db.js` — small IndexedDB wrapper.
- `styles.css` — UI styles.
- `icons/icon48.svg` — extension icon.

How it works
- Press Alt+S on any normal web page. The background worker asks the content script for the page text, captures the visible tab screenshot, stores the data temporarily, and opens the `capture.html` popup.
- Fill in the "Context" and optional remainder time and click Save. The record is stored in IndexedDB and accessible from the extension popup.

Notes & caveats
- `chrome.tabs.captureVisibleTab` is used to take the screenshot. Depending on browser security and permissions this may not work on certain special pages (chrome://, internal pages) or if the extension does not have required permissions. If capture fails you'll still be able to save page text and notes.
- The extension uses `storage.local` for a temporary handoff between the background worker and the capture window.

Install (developer mode)
1. Open chrome://extensions (or edge://extensions).
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `extension/` folder.

Next steps / improvements
- Add optional reminders/notifications based on the remainder time.
- Add searching/filtering and export/import backup.
- Add nicer UI and thumbnail generation.
