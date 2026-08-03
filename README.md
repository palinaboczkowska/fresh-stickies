# Fresh Stickies

Chrome extension: sticky notes you can place anywhere on Freshdesk/Freshservice pages. A note belongs to the page (origin + path) it was created on and stays until someone removes it.

**Deliberately NOT an FDK app** — FDK apps are sandboxed to their iframe placement and cannot overlay the host page. A browser extension's content script can.

## Install (unpacked, for development)

1. Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select this folder (`fresh-stickies/`)
4. Open any `*.freshdesk.com` / `*.freshservice.com` page → a 🗒️ button appears bottom-right

## Use

- **🗒️ button** → new note on the current page
- **Drag** by the top strip · **✕** (visible on hover) removes
- Notes autosave (400 ms debounce) to `chrome.storage.local`

## Scope of the MVP (v0.1)

- **Personal**: notes live in *your* browser profile only. Shared notes ("until *someone* removes it") need a backend (Supabase table + realtime) — planned v2.
- **Viewport-anchored**: position is fixed relative to the window, per page URL. Element-anchoring (note follows a specific setting row) — v2.
- SPA navigation handled by polling `location.href` (800 ms).

## Watch-outs

- FD/FS can change their DOM/CSP anytime; content-script CSS/JS run in an isolated world so the risk is mainly cosmetic (launcher overlapping their widgets).
- Be deliberate about notes on **customer** instances during screen shares.

## Files

- `manifest.json` — MV3, content script matched on freshdesk/freshservice/myfreshworks domains
- `content.js` — render/drag/save logic, no build step, no dependencies
- `content.css` — prefixed styles (`fsticky-*`)
