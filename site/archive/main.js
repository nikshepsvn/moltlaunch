// --- Constants ---
const RM_ADDRESS = "0x3Bc08524d9DaaDEC9d1Af87818d809611F0fD669";
const FLAUNCH_ADDRESS = "0xb4512bf57d50fbcb64a3adf8b17a79b2a204c18c";
const RPC_URL = "https://base-rpc.publicnode.com";
const FLAUNCH_URL = "https://flaunch.gg/base";
const FLAUNCH_DATA_API = "https://dev-api.flayerlabs.xyz/v1/base";
const CHUNK_SIZE = 50000;
const START_BLOCK = 41_500_000;

const BALANCE_OF_SIG = "0x70a08231";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";

// --- DOM refs ---
const $content = document.getElementById("content");
const $count = document.getElementById("token-count");
const $termLines = document.getElementById("terminal-lines");
const $progressBar = document.getElementById("progress-bar");
const $loadingStatus = document.getElementById("loading-status");

// --- Terminal loading UI ---
function tlog(msg, cls = "dim") {
  const div = document.createElement("div");
  div.className = `line ${cls}`;
  div.textContent = msg;
  $termLines.appendChild(div);
  $termLines.parentElement.scrollTop = $termLines.parentElement.scrollHeight;
}

function setProgress(pct, label) {
  $progressBar.style.width = pct + "%";
  if (label) $loadingStatus.textContent = label;
}

// --- RPC helpers (minimal — only used for token discovery) ---
function padAddress(addr) {
  return "0x" + addr.replace("0x", "").toLowerCase().padStart(64, "0");
}

function truncate(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function rpcBatch(calls) {
  const body = calls.map((c, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: c.method,
    params: c.params,
  }));
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const results = await res.json();
  const sorted = results.sort((a, b) => a.id - b.id);
  return sorted.map((r) => {
    if (r.error) throw new Error(r.error.message);
    return r.result;
  });
}

async function pMap(items, fn, concurrency = 6) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function getBlockNumber() {
  return Number(await rpc("eth_blockNumber", []));
}

async function balanceOf(contract, owner) {
  const data = BALANCE_OF_SIG + padAddress(owner).slice(2);
  return Number(await rpc("eth_call", [{ to: contract, data }, "latest"]));
}

async function getTransferEvents(fromBlock, toBlock) {
  const logs = await rpc("eth_getLogs", [{
    address: FLAUNCH_ADDRESS,
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock: "0x" + toBlock.toString(16),
    topics: [TRANSFER_TOPIC, null, padAddress(RM_ADDRESS)],
  }]);
  return logs || [];
}

function extractTokenFromReceipt(receipt) {
  if (!receipt) return null;
  for (const log of receipt.logs) {
    if (
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics.length === 3 &&
      log.topics[1] === ZERO_TOPIC &&
      log.address.toLowerCase() !== FLAUNCH_ADDRESS.toLowerCase()
    ) return log.address;
  }
  return null;
}

// --- Flaunch REST API (replaces name/symbol/image/tokenURI/IPFS RPC calls) ---
let ethUsdPrice = 0;

async function fetchEthPrice() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await res.json();
    ethUsdPrice = data.ethereum?.usd ?? 0;
  } catch { ethUsdPrice = 0; }
}

// Single call: gets name, symbol, image, description, mcap, price, volume, holders, socials
async function fetchTokenFull(tokenAddress) {
  try {
    const [detailsRes, holdersRes] = await Promise.all([
      fetch(`${FLAUNCH_DATA_API}/tokens/${tokenAddress}/details`),
      fetch(`${FLAUNCH_DATA_API}/tokens/${tokenAddress}/holders`),
    ]);
    const details = detailsRes.ok ? await detailsRes.json() : null;
    const holders = holdersRes.ok ? await holdersRes.json() : null;

    if (!details) return null;

    return {
      name: details.name || "",
      symbol: details.symbol || "",
      image: details.image || "",
      description: details.description || "",
      websiteUrl: details.socials?.website || null,
      details: {
        mcapEth: Number(details.price?.marketCapETH ?? "0") / 1e18,
        priceChange: parseFloat(details.price?.priceChange24h ?? "0"),
        vol24hEth: Number(details.volume?.volume24h ?? "0") / 1e18,
        totalHolders: parseInt(holders?.totalHolders ?? "0", 10),
      },
    };
  } catch {
    return null;
  }
}

// --- Formatters ---
function formatMcap(ethVal) {
  if (ethVal <= 0) return "--";
  if (ethUsdPrice > 0) {
    const usd = ethVal * ethUsdPrice;
    if (usd >= 1_000_000) return "$" + (usd / 1_000_000).toFixed(1) + "M";
    if (usd >= 1_000) return "$" + (usd / 1_000).toFixed(1) + "K";
    return "$" + usd.toFixed(0);
  }
  if (ethVal >= 1000) return (ethVal / 1000).toFixed(1) + "K ETH";
  if (ethVal >= 1) return ethVal.toFixed(2) + " ETH";
  return ethVal.toFixed(4) + " ETH";
}

function formatVol(ethVal) {
  if (ethVal <= 0) return "--";
  if (ethUsdPrice > 0) {
    const usd = ethVal * ethUsdPrice;
    if (usd >= 1_000_000) return "$" + (usd / 1_000_000).toFixed(1) + "M";
    if (usd >= 1_000) return "$" + (usd / 1_000).toFixed(1) + "K";
    return "$" + usd.toFixed(0);
  }
  if (ethVal >= 1) return ethVal.toFixed(2) + " ETH";
  return ethVal.toFixed(4) + " ETH";
}

function formatChange(pct) {
  if (pct === 0) return { text: "0.00%", cls: "neutral" };
  const sign = pct > 0 ? "+" : "";
  const cls = pct > 0 ? "positive" : "negative";
  return { text: sign + pct.toFixed(2) + "%", cls };
}

// =============================================================
// State — allTokens is THE single source of truth.
// Each token starts as { tokenId, txHash } from RPC scanning,
// then gets enriched via REST API (name, symbol, image, details).
// =============================================================
const PER_PAGE = 20;
let allTokens = [];
let filteredIndexes = [];
let currentPage = 1;
let searchQuery = "";
let sortBy = "mcap";
let filterMcap = 0;
let filterHolders = 0;
let filterWebsite = false;
let debounceTimer = null;

function isEnriched(t) { return !!t.name; }

function mcapUsd(t) {
  const eth = t.details?.mcapEth || 0;
  return ethUsdPrice > 0 ? eth * ethUsdPrice : eth;
}

// Enrich a batch: resolve addresses via RPC, then fetch everything else via REST API
async function enrichBatch(tokens) {
  const need = tokens.filter(t => !isEnriched(t));
  if (need.length === 0) return;

  // Step 1: Resolve addresses for tokens that only have txHash (RPC — only remaining chain call)
  const needAddr = need.filter(t => !t.address && t.txHash);
  if (needAddr.length > 0) {
    const calls = needAddr.map(t => ({ method: "eth_getTransactionReceipt", params: [t.txHash] }));
    const receipts = await rpcBatch(calls);
    needAddr.forEach((t, i) => {
      t.address = extractTokenFromReceipt(receipts[i]);
    });
    const failed = need.filter(t => !t.address);
    failed.forEach(t => { t._dead = true; });
  }

  const valid = need.filter(t => t.address);
  if (valid.length === 0) return;

  // Step 2: Fetch metadata + details from REST API (replaces name/symbol/image/IPFS RPC calls)
  await pMap(valid, async (t) => {
    const data = await fetchTokenFull(t.address);
    if (data) {
      t.name = data.name;
      t.symbol = data.symbol;
      t.image = data.image;
      t.description = data.description;
      t.websiteUrl = data.websiteUrl;
      t.details = data.details;
    } else {
      // Fallback: mark with address as name
      t.name = truncate(t.address);
      t.symbol = "???";
    }
    updateCardInPlace(t);
  }, 8);

  // Update total mcap in stats
  const totalMcapEth = allTokens.reduce((sum, t) => sum + (t.details?.mcapEth || 0), 0);
  const $totalMcap = document.getElementById("total-mcap");
  if ($totalMcap && totalMcapEth > 0) $totalMcap.textContent = formatMcap(totalMcapEth);
}

// Filter + sort allTokens, producing filteredIndexes
function applyFilters() {
  const q = searchQuery.toLowerCase();
  const hasActiveFilter = q || filterMcap > 0 || filterHolders > 0 || filterWebsite;

  filteredIndexes = [];
  for (let i = 0; i < allTokens.length; i++) {
    const t = allTokens[i];
    if (t._dead) continue;
    if (!isEnriched(t)) {
      if (!hasActiveFilter) filteredIndexes.push(i);
      continue;
    }
    if (q && !t.name.toLowerCase().includes(q) && !t.symbol.toLowerCase().includes(q)) continue;
    if (filterMcap > 0 && mcapUsd(t) < filterMcap) continue;
    if (filterHolders > 0 && (t.details?.totalHolders || 0) < filterHolders) continue;
    if (filterWebsite && !t.websiteUrl) continue;
    filteredIndexes.push(i);
  }

  filteredIndexes.sort((ai, bi) => {
    const a = allTokens[ai];
    const b = allTokens[bi];
    if (!isEnriched(a) && !isEnriched(b)) return 0;
    if (!isEnriched(a)) return 1;
    if (!isEnriched(b)) return -1;
    switch (sortBy) {
      case "mcap": return mcapUsd(b) - mcapUsd(a);
      case "vol24h": return (b.details?.vol24hEth || 0) - (a.details?.vol24hEth || 0);
      case "change24h": return (b.details?.priceChange || 0) - (a.details?.priceChange || 0);
      case "holders": return (b.details?.totalHolders || 0) - (a.details?.totalHolders || 0);
      case "name": return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  currentPage = 1;
  renderPage();
  loadVisiblePage();
}

function renderPage() {
  const total = allTokens.length;
  const shown = filteredIndexes.length;
  $count.textContent = shown === total ? String(total) : `${shown}/${total}`;

  if (shown === 0) {
    $content.innerHTML = `<div class="empty">${total === 0 ? "no tokens launched yet." : "no tokens match filters."}</div>`;
    return;
  }

  const totalPages = Math.ceil(shown / PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PER_PAGE;
  const pageIndexes = filteredIndexes.slice(start, start + PER_PAGE);

  const gridHtml = pageIndexes.map((idx, i) => {
    const t = allTokens[idx];
    const enriched = isEnriched(t);
    const d = t.details || {};
    const ch = formatChange(d.priceChange || 0);
    const loadCls = (enriched && t.details) ? "" : " loading";
    let websiteHtml = '';
    if (t.websiteUrl) {
      try {
        const host = new URL(t.websiteUrl).hostname.replace('www.', '');
        websiteHtml = `<a class="token-website" href="${t.websiteUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${host}</a>`;
      } catch { /* skip */ }
    }
    const cardId = t.address || t.txHash;
    const href = t.address ? `${FLAUNCH_URL}/coin/${t.address}` : "#";
    return `
    <a class="token-card" data-token-addr="${cardId}" href="${href}" target="_blank" rel="noopener" style="text-decoration:none;animation-delay:${i * 0.06}s">
      ${enriched && t.image ? `<img class="token-img" src="${t.image}" alt="${t.name}" />` : '<div class="token-img-placeholder"></div>'}
      <div class="token-name">${enriched ? t.name : "loading..."}</div>
      <div class="token-symbol">${enriched ? t.symbol : "..."}</div>
      <div class="token-address">${t.address ? truncate(t.address) : "resolving..."}</div>
      ${websiteHtml}
      <div class="token-meta">
        <div class="token-meta-item">
          <span class="token-meta-label">mcap</span>
          <span class="token-meta-value${loadCls}">${d.mcapEth ? formatMcap(d.mcapEth) : "--"}</span>
        </div>
        <div class="token-meta-item">
          <span class="token-meta-label">24h</span>
          <span class="token-meta-value${loadCls} ${ch.cls}">${d.mcapEth ? ch.text : "--"}</span>
        </div>
        <div class="token-meta-item">
          <span class="token-meta-label">vol 24h</span>
          <span class="token-meta-value${loadCls}">${d.vol24hEth !== undefined ? formatVol(d.vol24hEth) : "--"}</span>
        </div>
        <div class="token-meta-item">
          <span class="token-meta-label">holders</span>
          <span class="token-meta-value${loadCls}">${d.totalHolders || "--"}</span>
        </div>
      </div>
    </a>`;
  }).join("");

  const paginationHtml = totalPages > 1 ? `
    <div class="pagination">
      <button class="pagination-btn" id="prev-page" ${currentPage <= 1 ? 'disabled' : ''}>&lt; prev</button>
      <span class="pagination-info">page ${currentPage} of ${totalPages}</span>
      <button class="pagination-btn" id="next-page" ${currentPage >= totalPages ? 'disabled' : ''}>next &gt;</button>
    </div>` : '';

  $content.innerHTML = `
    <div class="token-grid">${gridHtml}</div>
    ${paginationHtml}`;

  document.getElementById("prev-page")?.addEventListener("click", () => {
    currentPage--;
    renderPage();
    loadVisiblePage();
  });
  document.getElementById("next-page")?.addEventListener("click", () => {
    currentPage++;
    renderPage();
    loadVisiblePage();
  });
}

function loadVisiblePage() {
  const start = (currentPage - 1) * PER_PAGE;
  const pageIndexes = filteredIndexes.slice(start, start + PER_PAGE);
  const pageTokens = pageIndexes.map(i => allTokens[i]);
  const needEnrich = pageTokens.filter(t => !isEnriched(t));
  if (needEnrich.length > 0) {
    enrichBatch(needEnrich);
  }
}

function updateCardInPlace(token) {
  let card = document.querySelector(`[data-token-addr="${token.address}"]`);
  if (!card && token.txHash) {
    card = document.querySelector(`[data-token-addr="${token.txHash}"]`);
    if (card) {
      card.dataset.tokenAddr = token.address;
      card.href = `${FLAUNCH_URL}/coin/${token.address}`;
    }
  }
  if (!card) return;

  const nameEl = card.querySelector(".token-name");
  const symbolEl = card.querySelector(".token-symbol");
  const addrEl = card.querySelector(".token-address");
  if (nameEl) nameEl.textContent = token.name;
  if (symbolEl) symbolEl.textContent = token.symbol;
  if (addrEl) addrEl.textContent = truncate(token.address);

  // Swap placeholder for real image
  const imgEl = card.querySelector(".token-img-placeholder");
  if (imgEl && token.image) {
    const img = document.createElement("img");
    img.className = "token-img";
    img.src = token.image;
    img.alt = token.name;
    imgEl.replaceWith(img);
  }

  // Update metrics
  const d = token.details || {};
  const ch = formatChange(d.priceChange || 0);
  const metaValues = card.querySelectorAll(".token-meta-value");
  metaValues.forEach(el => el.classList.remove("loading"));
  if (metaValues[0]) metaValues[0].textContent = d.mcapEth ? formatMcap(d.mcapEth) : "--";
  if (metaValues[1]) {
    metaValues[1].textContent = d.mcapEth ? ch.text : "--";
    metaValues[1].className = `token-meta-value ${ch.cls}`;
  }
  if (metaValues[2]) metaValues[2].textContent = d.vol24hEth !== undefined ? formatVol(d.vol24hEth) : "--";
  if (metaValues[3]) metaValues[3].textContent = d.totalHolders || "--";

  // Insert website link
  if (token.websiteUrl && !card.querySelector(".token-website")) {
    try {
      const host = new URL(token.websiteUrl).hostname.replace('www.', '');
      const link = document.createElement("a");
      link.className = "token-website";
      link.href = token.websiteUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = host;
      link.addEventListener("click", e => e.stopPropagation());
      const metaDiv = card.querySelector(".token-meta");
      if (metaDiv) card.insertBefore(link, metaDiv);
    } catch { /* skip */ }
  }
}

// --- Controls ---
function initControls() {
  const $search = document.getElementById("search-input");
  const $sort = document.getElementById("sort-select");

  $search.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = $search.value.trim();
      applyFilters();
    }, 150);
  });

  $sort.addEventListener("change", () => {
    sortBy = $sort.value;
    applyFilters();
  });

  document.querySelectorAll('.filter-chip[data-filter="mcap"]').forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll('.filter-chip[data-filter="mcap"]').forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterMcap = Number(btn.dataset.value);
      applyFilters();
    });
  });

  document.querySelectorAll('.filter-chip[data-filter="holders"]').forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll('.filter-chip[data-filter="holders"]').forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterHolders = Number(btn.dataset.value);
      applyFilters();
    });
  });

  document.getElementById("filter-website").addEventListener("click", (e) => {
    filterWebsite = !filterWebsite;
    e.currentTarget.classList.toggle("active", filterWebsite);
    applyFilters();
  });
}

function renderError(msg) {
  $content.innerHTML = `<div class="error">${msg}</div>`;
}

// --- Main ---
async function main() {
  initControls();
  try { localStorage.removeItem("moltlaunch_tokens"); } catch {}

  try {
    tlog("moltlaunch v1.1 — base mainnet", "info");
    tlog("connecting to base-rpc.publicnode.com...", "dim");
    setProgress(5, "connecting to Base RPC...");

    const SKIP_TOKENS = 5;
    const rawCount = await balanceOf(FLAUNCH_ADDRESS, RM_ADDRESS);
    const count = Math.max(0, rawCount - SKIP_TOKENS);
    $count.textContent = count;
    tlog(`  balanceOf: ${rawCount} (showing ${count})`, "ok");
    setProgress(15, `found ${count} token(s)`);

    if (count === 0) {
      tlog("no tokens found.", "warn");
      setProgress(100, "done");
      $content.innerHTML = '<div class="empty">no tokens launched yet.</div>';
      return;
    }

    // Fetch ETH price in background
    fetchEthPrice().then(() => {
      if (ethUsdPrice > 0) tlog(`  ETH/USD: $${ethUsdPrice.toLocaleString()}`, "info");
    });

    // Scan blockchain for Transfer events to revenue manager
    tlog("scanning transfer events...", "dim");
    setProgress(20, "scanning blockchain...");
    const currentBlock = await getBlockNumber();
    tlog(`  head: #${currentBlock.toLocaleString()}`, "dim");

    const chunks = [];
    for (let from = START_BLOCK; from <= currentBlock; from += CHUNK_SIZE) {
      chunks.push({ from, to: Math.min(from + CHUNK_SIZE - 1, currentBlock) });
    }
    tlog(`  ${chunks.length} block range(s)`, "dim");

    const chunkResults = await pMap(
      chunks,
      ({ from, to }) => getTransferEvents(from, to),
      4
    );
    const allLogs = chunkResults.flat();
    tlog(`  ${allLogs.length} transfer(s)`, "ok");
    setProgress(60, "deduplicating...");

    const seen = new Set();
    const uniqueLogs = allLogs.filter(l => {
      const id = l.topics[3];
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Build lightweight stubs — metadata fetched via REST API per page
    allTokens = uniqueLogs.map(l => ({
      tokenId: BigInt(l.topics[3]).toString(),
      txHash: l.transactionHash,
    })).slice(SKIP_TOKENS);
    tlog(`  ${allTokens.length} token(s) found`, "ok");
    setProgress(80, "rendering...");

    // Show controls + render page 1 with skeleton cards
    document.getElementById("controls-bar").style.display = "flex";
    $count.textContent = String(allTokens.length);

    filteredIndexes = allTokens.map((_, i) => i);
    renderPage();
    loadVisiblePage();

    setProgress(100, "done — loading page details...");
    tlog("  page 1 loading...", "info");

  } catch (err) {
    console.error(err);
    tlog(`ERROR: ${err.message}`, "warn");
    setProgress(100, "failed");
    renderError(`failed to query blockchain: ${err.message}`);
  }
}

function copyCmd() {
  const text = document.getElementById("cmd-text").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(".copy-btn");
    btn.textContent = "copied";
    setTimeout(() => { btn.textContent = "copy"; }, 1500);
  });
}

// --- Panel ---
const $modalOverlay = document.getElementById("modal-overlay");
const $modalPanel = document.getElementById("modal-panel");

function openModal() {
  $modalOverlay.classList.add("open");
  $modalPanel.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $modalOverlay.classList.remove("open");
  $modalPanel.classList.remove("open");
  document.body.style.overflow = "";
}

// --- Thesis Panel ---
const $thesisOverlay = document.getElementById("thesis-overlay");
const $thesisPanel = document.getElementById("thesis-panel");

function openThesis() {
  $thesisOverlay.classList.add("open");
  $thesisPanel.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeThesis() {
  $thesisOverlay.classList.remove("open");
  $thesisPanel.classList.remove("open");
  document.body.style.overflow = "";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if ($modalPanel.classList.contains("open")) closeModal();
    if ($thesisPanel.classList.contains("open")) closeThesis();
  }
});

main();
