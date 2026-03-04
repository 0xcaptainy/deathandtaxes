// ═══════════════════════════════════════════════════════════════
// DEATH & TAXES — Background Service Worker (Hardened v2.1)
// Sender verified. Input sanitized. SSRF prevented.
// ═══════════════════════════════════════════════════════════════

const API_BASE = "https://proxy-death.vercel.app/ext";

function validId(id) {
  const n = parseInt(id);
  return Number.isInteger(n) && n >= 1 && n <= 6969;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Fix 1: Only accept messages from this extension
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === "batch") {
    // Fix 3: Validate IDs then rebuild URL from clean integers only
    const cleanIds = (msg.ids || []).filter(validId).map(id => parseInt(id));
    if (cleanIds.length === 0) {
      sendResponse({ ok: false, error: "No valid IDs" });
      return true;
    }
    const batch = cleanIds.slice(0, 50);
    const url = `${API_BASE}/batch/${batch.join(",")}`;

    fetch(url, { signal: AbortSignal.timeout(10000) })
      .then(res => {
        // Fix 4: Check response status before parsing
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (typeof data !== "object" || data === null) {
          throw new Error("Invalid response format");
        }
        sendResponse({ ok: true, data });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "citizen") {
    // Fix 3: Validate and rebuild from clean integer
    if (!validId(msg.id)) {
      sendResponse({ ok: false, error: "Invalid ID" });
      return true;
    }
    const cid = parseInt(msg.id);
    const url = `${API_BASE}/citizen/${cid}`;

    fetch(url, { signal: AbortSignal.timeout(5000) })
      .then(res => {
        // Fix 4: Check response status
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (typeof data !== "object" || data === null) {
          throw new Error("Invalid response format");
        }
        sendResponse({ ok: true, data });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
