// Popup: personal hide toggles ("demo mode"). State lives in
// chrome.storage.local; the content script reacts via storage.onChanged.

const DEFAULTS = { hideAll: false, hiddenOrigins: {} };

async function getSettings() {
  const data = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(data.settings || {}) };
}

async function init() {
  const hideOriginBox = document.getElementById("hideOrigin");
  const hideAllBox = document.getElementById("hideAll");
  const originLabel = document.getElementById("originLabel");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let origin = null;
  try {
    const u = new URL(tab.url);
    if (/\.(freshdesk|freshservice|myfreshworks)\.com$/.test(u.hostname)) {
      origin = u.origin;
      originLabel.textContent = u.hostname;
    }
  } catch {
    /* chrome:// pages etc — leave origin null */
  }
  if (!origin) {
    hideOriginBox.disabled = true;
    originLabel.textContent = "den här sidan (ingen FD/FS-flik)";
  }

  const settings = await getSettings();
  hideAllBox.checked = settings.hideAll;
  if (origin) hideOriginBox.checked = !!settings.hiddenOrigins[origin];

  hideOriginBox.addEventListener("change", async () => {
    const s = await getSettings();
    if (hideOriginBox.checked) {
      s.hiddenOrigins[origin] = true;
    } else {
      delete s.hiddenOrigins[origin];
    }
    await chrome.storage.local.set({ settings: s });
  });

  hideAllBox.addEventListener("change", async () => {
    const s = await getSettings();
    s.hideAll = hideAllBox.checked;
    await chrome.storage.local.set({ settings: s });
  });
}

init();
