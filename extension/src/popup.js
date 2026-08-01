const shareBtn = document.getElementById("shareBtn");
const copyBtn = document.getElementById("copyBtn");
const statusEl = document.getElementById("status");

let lastShareUrl = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function setStatusWithLink(label, url) {
  statusEl.textContent = "";
  statusEl.appendChild(document.createTextNode(label));
  statusEl.appendChild(document.createElement("br"));
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.textContent = url;
  statusEl.appendChild(a);
}

shareBtn.addEventListener("click", async () => {
  shareBtn.disabled = true;
  setStatus("Reading your cart…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const isCartUrl = tab?.url && /amazon\.(com|in)\/(gp\/)?cart/i.test(tab.url);
    if (!isCartUrl) {
      setStatus("Open your Amazon cart page first, then click this again.");
      shareBtn.disabled = false;
      return;
    }

    const scrapeResult = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_CART" });

    if (!scrapeResult?.ok) {
      setStatus("Couldn't read the cart. Try refreshing the page.");
      shareBtn.disabled = false;
      return;
    }

    if (scrapeResult.items.length === 0) {
      setStatus("No items found in this cart.");
      shareBtn.disabled = false;
      return;
    }

    setStatus(`Found ${scrapeResult.items.length} item(s). Creating link…`);

    const response = await chrome.runtime.sendMessage({
      type: "CREATE_SHARED_CART",
      items: scrapeResult.items,
      domain: scrapeResult.domain,
    });

    if (!response?.ok) {
      setStatus(response?.error || "Couldn't create the share link. Is the backend running?");
      shareBtn.disabled = false;
      return;
    }

    lastShareUrl = response.shareUrl;
    setStatusWithLink("Share link ready:", lastShareUrl);
    copyBtn.style.display = "block";
  } catch (err) {
    setStatus(`Something went wrong: ${String(err)}`);
  } finally {
    shareBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!lastShareUrl) return;
  await navigator.clipboard.writeText(lastShareUrl);
  copyBtn.textContent = "Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy link"), 1500);
});
