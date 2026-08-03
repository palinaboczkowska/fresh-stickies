# Fresh Stickies

Chrome extension: sticky notes you can place anywhere on Freshdesk/Freshservice pages. A note belongs to the page (origin + path) it was created on and stays until someone removes it.

**v0.2: notes are SHARED** — everyone with the extension installed sees the same notes, live-ish (8 s poll). Backend: Supabase project `fresh-stickies` (Scaly org), plain PostgREST calls, no SDK. Schema + the deliberate internal-tool access model: `supabase/schema.sql`.

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

- **Shared, last-write-wins**: 8 s polling, no realtime channel, no auth — anyone with the publishable key can read/write (fine for an internal Scaly tool in a private repo; switch to Supabase Auth before wider distribution).
- The poll never re-renders while you're typing or dragging, so edits aren't clobbered mid-stroke.
- **Viewport-anchored**: position is fixed relative to the window, per page URL. Element-anchoring (note follows a specific setting row) — future.
- SPA navigation handled by polling `location.href` (1 s, network only every 8 s).

## Watch-outs

- FD/FS can change their DOM/CSP anytime; content-script CSS/JS run in an isolated world so the risk is mainly cosmetic (launcher overlapping their widgets).
- Be deliberate about notes on **customer** instances during screen shares.

## Files

- `manifest.json` — MV3, content script matched on freshdesk/freshservice/myfreshworks domains
- `config.js` — Supabase URL + publishable key
- `content.js` — render/drag/sync logic, no build step, no dependencies
- `content.css` — prefixed styles (`fsticky-*`)
- `supabase/schema.sql` — table, RLS policies, access-model rationale
