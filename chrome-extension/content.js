/**
 * Pixlance Content Script
 * Auto-injects "Import to Pixlance" button on eBay, AliExpress, Amazon product pages
 */

const PIXLANCE_URL = "https://pixlance.pages.dev";

// ── Platform detection ────────────────────────────────────────────────────────
function detectPlatform() {
  const host = location.hostname;
  if (host.includes("ebay.")) return "ebay";
  if (host.includes("aliexpress.")) return "aliexpress";
  if (host.includes("amazon.")) return "amazon";
  return "generic";
}

// ── Data extraction per platform ──────────────────────────────────────────────
function extractPageData() {
  const platform = detectPlatform();
  const data = { platform, url: location.href, title: "", price: null, images: [], brand: "" };

  if (platform === "ebay") {
    data.title = document.querySelector(".x-item-title__mainTitle span, [itemprop='name']")?.textContent?.trim() ?? document.title;
    data.price = parseFloat(document.querySelector("[itemprop='price']")?.getAttribute("content") ?? "0") || null;
    data.brand = document.querySelector("[itemprop='brand'] span")?.textContent?.trim() ?? "";
    data.images = [...document.querySelectorAll(".ux-image-carousel-item img, .vi-image-gallery img")]
      .map(img => img.src || img.dataset.src || "").filter(s => s && s.length > 20).slice(0, 8);
  } else if (platform === "aliexpress") {
    data.title = document.querySelector("h1")?.textContent?.trim() ?? document.title;
    data.images = [...document.querySelectorAll("[data-zoom-image], .images-view-item img")]
      .map(el => el.dataset?.zoomImage || el.src || "").filter(Boolean).slice(0, 8);
  } else if (platform === "amazon") {
    data.title = document.querySelector("#productTitle")?.textContent?.trim() ?? document.title;
    data.price = parseFloat(document.querySelector(".a-price-whole")?.textContent?.replace(/[^0-9.]/g, "") ?? "0") || null;
    data.brand = document.querySelector("#bylineInfo")?.textContent?.replace(/Visit the |Store/g, "").trim() ?? "";
    data.images = [...document.querySelectorAll("#altImages img, #main-image-container img")]
      .map(img => img.src?.replace(/_[A-Z]{2}\d+_/g, "_SL1500_") ?? "").filter(s => s.includes("http")).slice(0, 8);
  }

  return data;
}

// ── Build the floating button ─────────────────────────────────────────────────
function createPixlanceButton() {
  if (document.getElementById("pixlance-btn")) return;

  const platform = detectPlatform();
  const platformLabel = { ebay: "eBay", aliexpress: "AliExpress", amazon: "Amazon", generic: "Page" }[platform];

  const wrapper = document.createElement("div");
  wrapper.id = "pixlance-btn";
  wrapper.innerHTML = `
    <div class="plc-fab">
      <div class="plc-logo">P</div>
      <div class="plc-content">
        <div class="plc-title">Import to Pixlance</div>
        <div class="plc-sub">Optimize this ${platformLabel} listing →</div>
      </div>
      <div class="plc-arrow">⚡</div>
    </div>
    <div class="plc-status" id="plc-status" style="display:none"></div>
  `;

  document.body.appendChild(wrapper);

  wrapper.querySelector(".plc-fab").addEventListener("click", handleImport);
}

// ── Import handler ─────────────────────────────────────────────────────────────
async function handleImport(e) {
  e.preventDefault();
  const statusEl = document.getElementById("plc-status");
  const fab = document.querySelector(".plc-fab");

  fab.classList.add("plc-loading");
  statusEl.style.display = "block";
  statusEl.textContent = "Extracting product data...";

  try {
    const pageData = extractPageData();
    statusEl.textContent = "Running eBay optimization pipeline...";

    // Try API-based import (will work if user's Pixlance backend is running)
    // Fallback: open Pixlance with the URL pre-filled
    const response = await fetch(`https://pixlance.pages.dev/api/ebay/extension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(pageData),
    }).catch(() => null);

    if (response && response.ok) {
      const result = await response.json();
      statusEl.textContent = `✓ Done! Title score: ${result.listing?.titleScore ?? "—"}/100`;
      setTimeout(() => {
        const url = `${PIXLANCE_URL}/listing?id=${result.pipelineId}`;
        chrome.runtime.sendMessage({ action: "openTab", url });
      }, 800);
    } else {
      // Fallback: pass URL to Pixlance listing page
      statusEl.textContent = "Opening Pixlance...";
      const url = `${PIXLANCE_URL}/listing?url=${encodeURIComponent(pageData.url)}`;
      chrome.runtime.sendMessage({ action: "openTab", url });
    }
  } catch (err) {
    statusEl.textContent = "Opening Pixlance...";
    const url = `${PIXLANCE_URL}/listing?url=${encodeURIComponent(location.href)}`;
    chrome.runtime.sendMessage({ action: "openTab", url });
  } finally {
    fab.classList.remove("plc-loading");
    setTimeout(() => { statusEl.style.display = "none"; }, 3000);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createPixlanceButton);
} else {
  createPixlanceButton();
}
