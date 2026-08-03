// Fresh Stickies v2 — SHARED sticky notes overlaid on Freshdesk/Freshservice.
//
// Notes live in Supabase (see config.js + supabase/schema.sql) so everyone
// with the extension sees the same notes on the same page. A note is keyed
// by origin + pathname. Sync model: straight REST against PostgREST, poll
// every 8 s, last write wins. The poll never re-renders while you are
// typing in or dragging a note, so your edit can't be clobbered mid-stroke.

(() => {
  const POLL_MS = 8000;
  let currentPageKey = pageKey();
  let lastSnapshot = "";
  let dragging = false;
  const textTimers = new Map();

  function pageKey() {
    return location.origin + location.pathname;
  }

  // ---- Supabase REST ------------------------------------------------------

  function api(path, opts = {}) {
    return fetch(`${FSTICKY_CONFIG.url}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: FSTICKY_CONFIG.key,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
  }

  async function fetchNotes(key) {
    const res = await api(
      `stickies?select=*&page_key=eq.${encodeURIComponent(key)}&order=created_at`
    );
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return res.json();
  }

  function createNote(note) {
    return api("stickies", {
      method: "POST",
      body: JSON.stringify(note),
    }).catch((e) => console.warn("[fresh-stickies] create failed", e));
  }

  function patchNote(id, fields) {
    return api(`stickies?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    }).catch((e) => console.warn("[fresh-stickies] update failed", e));
  }

  function deleteNote(id) {
    return api(`stickies?id=eq.${id}`, { method: "DELETE" }).catch((e) =>
      console.warn("[fresh-stickies] delete failed", e)
    );
  }

  // ---- DOM ----------------------------------------------------------------

  function root() {
    let el = document.getElementById("fsticky-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "fsticky-root";
      // FD/FS bind keyboard shortcuts at document level and don't recognize
      // our textarea as an input — typing in a note would trigger shortcuts
      // (e.g. "Execute scenarios"). Stop key events from bubbling past us.
      for (const type of ["keydown", "keypress", "keyup"]) {
        el.addEventListener(type, (e) => e.stopPropagation());
      }
      document.documentElement.appendChild(el);
    }
    return el;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(v, max));
  }

  // Each note keeps its own slight tilt (-2.5..2.5 deg), derived from its id
  // so it survives re-renders instead of jumping on every navigation.
  function tilt(id) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return ((h / 997) * 5 - 2.5).toFixed(2);
  }

  function editingInProgress() {
    const active = document.activeElement;
    return dragging || (active && active.classList?.contains("fsticky-text"));
  }

  function renderNote(note) {
    const el = document.createElement("div");
    el.className = "fsticky-note";
    el.dataset.id = note.id;
    el.style.left = clamp(note.x, 0, window.innerWidth - 60) + "px";
    el.style.top = clamp(note.y, 0, window.innerHeight - 40) + "px";
    el.style.setProperty("--fsticky-tilt", tilt(note.id) + "deg");

    const bar = document.createElement("div");
    bar.className = "fsticky-bar";

    const close = document.createElement("button");
    close.className = "fsticky-close";
    close.textContent = "✕";
    close.title = "Ta bort lappen (för alla)";
    close.addEventListener("click", () => {
      el.remove();
      deleteNote(note.id);
    });

    bar.appendChild(close);

    const ta = document.createElement("textarea");
    ta.className = "fsticky-text";
    ta.placeholder = "Skriv här…";
    ta.value = note.text || "";
    ta.addEventListener("input", () => {
      clearTimeout(textTimers.get(note.id));
      textTimers.set(
        note.id,
        setTimeout(() => patchNote(note.id, { text: ta.value }), 500)
      );
    });

    el.appendChild(bar);
    el.appendChild(ta);

    // Drag by the top bar (not the textarea, so text selection still works).
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      dragging = true;
      const startX = e.clientX - el.offsetLeft;
      const startY = e.clientY - el.offsetTop;
      const move = (ev) => {
        el.style.left = clamp(ev.clientX - startX, 0, window.innerWidth - 60) + "px";
        el.style.top = clamp(ev.clientY - startY, 0, window.innerHeight - 40) + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        dragging = false;
        patchNote(note.id, {
          x: parseInt(el.style.left, 10),
          y: parseInt(el.style.top, 10),
        });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });

    root().appendChild(el);
  }

  function renderLauncher() {
    const btn = document.createElement("button");
    btn.id = "fsticky-launcher";
    btn.textContent = "🗒️";
    btn.title = "Ny klisterlapp på den här sidan — syns för alla (Fresh Stickies)";
    btn.addEventListener("click", () => {
      const n = {
        id: crypto.randomUUID(),
        page_key: currentPageKey,
        x: Math.round(window.innerWidth / 2 - 110 + Math.random() * 40),
        y: Math.round(window.innerHeight / 3 + Math.random() * 40),
        text: "",
      };
      renderNote(n);
      root().querySelector(`[data-id="${n.id}"] textarea`).focus();
      createNote(n);
    });
    root().appendChild(btn);
  }

  function renderPage(notes) {
    root().innerHTML = "";
    renderLauncher();
    for (const note of notes) renderNote(note);
  }

  // ---- Sync loop ----------------------------------------------------------

  async function sync(force = false) {
    if (editingInProgress()) return; // never clobber an edit in progress
    let notes;
    try {
      notes = await fetchNotes(currentPageKey);
    } catch (e) {
      console.warn("[fresh-stickies] sync failed", e);
      return;
    }
    const snapshot = JSON.stringify(notes.map((n) => [n.id, n.x, n.y, n.text]));
    if (force || snapshot !== lastSnapshot) {
      lastSnapshot = snapshot;
      renderPage(notes);
    }
  }

  setInterval(() => {
    if (pageKey() !== currentPageKey) {
      currentPageKey = pageKey();
      lastSnapshot = "";
      sync(true);
    } else {
      sync();
    }
  }, 1000);

  // Poll the backend on its own slower cadence; the 1 s loop above only
  // handles SPA navigation cheaply (no network) via the snapshot short-circuit.
  let lastPoll = 0;
  const origSync = sync;
  sync = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastPoll < POLL_MS) return;
    lastPoll = now;
    return origSync(force);
  };

  sync(true);
})();
