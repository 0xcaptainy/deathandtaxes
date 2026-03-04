// ═══════════════════════════════════════════════════════════════
// DEATH & TAXES — Background Service Worker (Hardened)
// HTTPS only. No raw IPs. Input validated.
// ═══════════════════════════════════════════════════════════════

const API_BASE = "https://proxy-death.vercel.app/ext";

// Validate token IDs are numbers in range
function validId(id) {
  const n = parseInt(id);
  return Number.isInteger(n) && n >= 1 && n <= 6969;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "batch") {
    // Validate all IDs
    const ids = (msg.ids || []).filter(validId);
    if (ids.length === 0) {
      sendResponse({ ok: false, error: "No valid IDs" });
      return true;
    }
    // Cap at 50
    const batch = ids.slice(0, 50).join(",");

    fetch(`${API_BASE}/batch/${batch}`, { signal: AbortSignal.timeout(10000) })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "citizen") {
    if (!validId(msg.id)) {
      sendResponse({ ok: false, error: "Invalid ID" });
      return true;
    }
    fetch(`${API_BASE}/citizen/${parseInt(msg.id)}`, { signal: AbortSignal.timeout(5000) })
      .then(res => res.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
