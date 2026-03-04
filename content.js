// ═══════════════════════════════════════════════════════════════
// DEATH & TAXES — Content Script (v2.1)
// Only runs on opensea.io/collection/deathandtaxes (locked in manifest)
// No innerHTML with API data. All DOM built safely.
// ═══════════════════════════════════════════════════════════════

const cache = new Map();
const CACHE_TTL = 60_000;

// ─── Safe DOM helpers ───────────────────────────────────────
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function safeInt(val) {
  const n = parseInt(val);
  return Number.isInteger(n) ? n : null;
}

// ─── API (via background worker) ────────────────────────────
function fetchBatch(tokenIds) {
  return new Promise(async (resolve) => {
    const results = {};
    const needed = [];

    for (const id of tokenIds) {
      const cached = cache.get(id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        results[id] = cached.data;
      } else {
        needed.push(id);
      }
    }

    if (needed.length === 0) return resolve(results);

    // Split into chunks of 10 to avoid proxy timeout on cold cache
    const chunks = [];
    for (let i = 0; i < needed.length; i += 10) {
      chunks.push(needed.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      await new Promise((res) => {
        chrome.runtime.sendMessage({ type: "batch", ids: chunk }, (response) => {
          if (chrome.runtime.lastError) { res(); return; }
          if (response && response.ok && response.data) {
            for (const [id, info] of Object.entries(response.data)) {
              if (info && typeof info === "object") {
                cache.set(id, { data: info, timestamp: Date.now() });
                results[id] = info;
              }
            }
          }
          res();
        });
      });
    }

    resolve(results);
  });
}

// ─── Badge Builder (safe DOM only) ──────────────────────────
function buildBadge(data, tokenId) {
  const badge = el("div", "dt-badge");
  badge.setAttribute("data-dt-id", tokenId);

  const header = el("div", "dt-badge-header");
  header.appendChild(el("span", "dt-badge-logo", "d/t"));
  header.appendChild(el("span", "dt-badge-id", "#" + tokenId));

  const tagsDiv = el("div", "dt-badge-tags");

  if (!data || data.error) {
    tagsDiv.appendChild(el("span", "dt-tag dt-tag-unknown", "NO DATA"));
    badge.appendChild(header);
    badge.appendChild(tagsDiv);
    return badge;
  }

  const epoch = safeInt(data.currentEpoch) || 0;

  // 1. Delinquent check
  const lastPaid = safeInt(data.lastEpochPaid);
  if (lastPaid !== null) {
    if (epoch > 0 && lastPaid < epoch - 1) {
      const behind = epoch - 1 - lastPaid;
      tagsDiv.appendChild(el("span", "dt-tag dt-tag-delinquent", "DELINQUENT (" + behind + "E BEHIND)"));
    } else if (lastPaid < epoch) {
      tagsDiv.appendChild(el("span", "dt-tag dt-tag-warning", "UNPAID THIS EPOCH"));
    } else {
      tagsDiv.appendChild(el("span", "dt-tag dt-tag-safe", "TAXES PAID"));
    }
  }

  // 2. Audit status
  const auditDue = safeInt(data.auditDue);
  if (data.isAudited && auditDue && auditDue > 0) {
    const now = Date.now();
    const remaining = auditDue - now;
    if (remaining <= 0) {
      tagsDiv.appendChild(el("span", "dt-tag dt-tag-killable", "KILLABLE"));
    } else {
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      const timeStr = hours > 0 ? hours + "H " + mins + "M" : mins + "M";
      const urgency = hours < 1 ? "dt-tag-critical" : hours < 3 ? "dt-tag-warning" : "dt-tag-audit";
      tagsDiv.appendChild(el("span", "dt-tag " + urgency, "AUDITED — " + timeStr + " LEFT"));
    }
  }

  // 3. Insurance
  if (data.hasInsurance === true) {
    tagsDiv.appendChild(el("span", "dt-tag dt-tag-insured", "INSURED"));
  }

  // 4. Bribe
  const bribe = safeInt(data.bribeBalance);
  if (bribe && bribe > 0) {
    tagsDiv.appendChild(el("span", "dt-tag dt-tag-bribe", "BRIBE: " + bribe));
  }

  if (tagsDiv.children.length === 0) {
    tagsDiv.appendChild(el("span", "dt-tag dt-tag-safe", "CLEAN"));
  }

  badge.appendChild(header);
  badge.appendChild(tagsDiv);
  return badge;
}

// ─── Loading placeholder ────────────────────────────────────
function buildPlaceholder(tokenId) {
  const badge = el("div", "dt-badge dt-badge-loading");
  badge.setAttribute("data-dt-id", tokenId);
  const header = el("div", "dt-badge-header");
  header.appendChild(el("span", "dt-badge-logo", "d/t"));
  header.appendChild(el("span", "dt-badge-id", "#" + tokenId));
  const tags = el("div", "dt-badge-tags");
  tags.appendChild(el("span", "dt-tag dt-tag-loading", "SCANNING..."));
  badge.appendChild(header);
  badge.appendChild(tags);
  return badge;
}

// ─── Token ID Extraction ────────────────────────────────────
function extractTokenId(card) {
  const imgs = card.querySelectorAll("img[alt]");
  for (const img of imgs) {
    const alt = img.getAttribute("alt") || "";
    const match = alt.match(/Item\s*#(\d+)/i);
    if (match && safeInt(match[1]) >= 1 && safeInt(match[1]) <= 6969) return match[1];
  }

  const allText = card.innerText || "";
  const citizenMatch = allText.match(/citizen\s+(\d+)/i);
  if (citizenMatch && safeInt(citizenMatch[1]) >= 1 && safeInt(citizenMatch[1]) <= 6969) {
    return citizenMatch[1];
  }

  return null;
}

function findNFTCards() {
  const selectors = ["article", '[role="gridcell"]', '[data-testid="ItemCard"]'];
  for (const sel of selectors) {
    const found = document.querySelectorAll(sel);
    if (found.length > 0) return Array.from(found);
  }
  return [];
}

// ─── Scan Page ──────────────────────────────────────────────
async function scanPage() {
  const cards = findNFTCards();
  if (cards.length === 0) return;

  const cardMap = [];
  for (const card of cards) {
    if (card.querySelector(".dt-badge")) continue;
    const tokenId = extractTokenId(card);
    if (tokenId) {
      const placeholder = buildPlaceholder(tokenId);
      card.style.position = "relative";
      card.insertBefore(placeholder, card.firstChild);
      cardMap.push({ card, tokenId, placeholder });
    }
  }

  if (cardMap.length === 0) return;

  const tokenIds = cardMap.map(c => c.tokenId);
  const batchData = await fetchBatch(tokenIds);

  for (const { tokenId, placeholder } of cardMap) {
    const data = batchData[tokenId] || null;
    const badge = buildBadge(data, tokenId);
    if (placeholder.parentNode) {
      placeholder.replaceWith(badge);
    }
  }
}

// ─── Retry NO DATA badges ───────────────────────────────────
async function retryFailed() {
  const failedBadges = document.querySelectorAll(".dt-badge");
  const retryMap = [];

  for (const badge of failedBadges) {
    if (!badge.querySelector(".dt-tag-unknown")) continue;
    const tokenId = badge.getAttribute("data-dt-id");
    if (!tokenId) continue;
    cache.delete(tokenId);
    retryMap.push({ tokenId, badge });
  }

  if (retryMap.length === 0) return;

  const tokenIds = retryMap.map(c => c.tokenId);
  const batchData = await fetchBatch(tokenIds);

  for (const { tokenId, badge } of retryMap) {
    const data = batchData[tokenId] || null;
    if (data && !data.error) {
      const newBadge = buildBadge(data, tokenId);
      if (badge.parentNode) badge.replaceWith(newBadge);
    }
  }
}

// ─── Init ───────────────────────────────────────────────────
scanPage();

setTimeout(scanPage, 2000);
setTimeout(scanPage, 5000);
setTimeout(retryFailed, 3000);
setTimeout(retryFailed, 6000);
setTimeout(retryFailed, 12000);

let scanTimeout = null;
function debouncedScan() {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(scanPage, 500);
}

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes.length > 0) { debouncedScan(); break; }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

let scrollTimeout;
window.addEventListener("scroll", () => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(scanPage, 1000);
});
