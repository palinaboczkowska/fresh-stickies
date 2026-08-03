// Fresh Stickies — sticky notes overlaid on Freshdesk/Freshservice pages.
//
// Notes are keyed by origin + pathname, so a note belongs to "this page"
// (e.g. a specific admin section or ticket). FD/FS are SPAs: the URL changes
// without a page load, so we poll location.href and re-render on change.
// Storage is chrome.storage.local — personal to this browser profile.

(() => {
  const STORE_KEY = "stickies";
  let currentPageKey = pageKey();
  let saveTimer = null;

  function pageKey() {
    return location.origin + location.pathname;
  }

  async function loadAll() {
    const data = await chrome.storage.local.get(STORE_KEY);
    return data[STORE_KEY] || {};
  }

  async function saveNotes(notes) {
    const all = await loadAll();
    if (notes.length) {
      all[currentPageKey] = notes;
    } else {
      delete all[currentPageKey];
    }
    await chrome.storage.local.set({ [STORE_KEY]: all });
  }

  function collectNotesFromDom() {
    return [...root().querySelectorAll(".fsticky-note")].map((el) => ({
      id: el.dataset.id,
      x: parseInt(el.style.left, 10),
      y: parseInt(el.style.top, 10),
      text: el.querySelector("textarea").value,
      createdAt: el.dataset.createdAt,
    }));
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNotes(collectNotesFromDom()), 400);
  }

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

  function renderNote(note) {
    const el = document.createElement("div");
    el.className = "fsticky-note";
    el.dataset.id = note.id;
    el.dataset.createdAt = note.createdAt;
    el.style.left = clamp(note.x, 0, window.innerWidth - 60) + "px";
    el.style.top = clamp(note.y, 0, window.innerHeight - 40) + "px";
    el.style.setProperty("--fsticky-tilt", tilt(note.id) + "deg");

    const bar = document.createElement("div");
    bar.className = "fsticky-bar";

    const close = document.createElement("button");
    close.className = "fsticky-close";
    close.textContent = "✕";
    close.title = "Ta bort lappen";
    close.addEventListener("click", () => {
      el.remove();
      scheduleSave();
    });

    bar.appendChild(close);

    const ta = document.createElement("textarea");
    ta.className = "fsticky-text";
    ta.placeholder = "Skriv här…";
    ta.value = note.text || "";
    ta.addEventListener("input", scheduleSave);

    el.appendChild(bar);
    el.appendChild(ta);

    // Drag by the top bar (not the textarea, so text selection still works).
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      const startX = e.clientX - el.offsetLeft;
      const startY = e.clientY - el.offsetTop;
      const move = (ev) => {
        el.style.left = clamp(ev.clientX - startX, 0, window.innerWidth - 60) + "px";
        el.style.top = clamp(ev.clientY - startY, 0, window.innerHeight - 40) + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        scheduleSave();
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
    btn.title = "Ny klisterlapp på den här sidan (Fresh Stickies)";
    btn.addEventListener("click", () => {
      const n = {
        id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
        x: Math.round(window.innerWidth / 2 - 110 + Math.random() * 40),
        y: Math.round(window.innerHeight / 3 + Math.random() * 40),
        text: "",
        createdAt: new Date().toISOString(),
      };
      renderNote(n);
      root().querySelector(`[data-id="${n.id}"] textarea`).focus();
      scheduleSave();
    });
    root().appendChild(btn);
  }

  async function renderPage() {
    root().innerHTML = "";
    renderLauncher();
    const all = await loadAll();
    for (const note of all[currentPageKey] || []) renderNote(note);
  }

  // SPA navigation: re-render when the URL path changes without a page load.
  setInterval(() => {
    if (pageKey() !== currentPageKey) {
      currentPageKey = pageKey();
      renderPage();
    }
  }, 800);

  renderPage();
})();
