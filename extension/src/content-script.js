// Runs only on the user's own Amazon cart page (see manifest.json content_scripts.matches).
// Reads what's already visible in the DOM — never touches network requests, cookies, or
// anyone else's account. Responds to a message from the popup with the parsed cart.

// Amazon's cart page also renders "Saved for later" and recommendation
// carousels with their own data-asin elements further down the same page.
// Scope to the active-cart container so we never scrape items the person
// isn't actually about to buy. Amazon has used a couple of container ids
// across redesigns, so we try each and fall back to the whole document
// only as a last resort.
const ACTIVE_CART_CONTAINER_SELECTORS = [
  "#sc-active-cart",
  "#activeCartViewForm",
  'form[name="activeCartViewForm"]',
];

function getActiveCartRoot() {
  for (const selector of ACTIVE_CART_CONTAINER_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return document;
}

// Amazon has shipped several markup variants for the same cart row across
// locales and A/B tests. Try each selector in order and use the first one
// that actually finds something, rather than betting everything on one path.
function firstMatch(root, selectors) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function extractItemDetails(row) {
  const titleEl = firstMatch(row, [
    "span.a-truncate-cut",
    ".sc-product-title",
    "h5 a span",
    ".a-link-normal .a-truncate-full",
    "a[href*='/dp/'] span",
  ]);

  const priceEl = firstMatch(row, [
    ".sc-product-price",
    ".sc-price",
    ".a-price .a-offscreen",
    "span.sc-price-instructions .a-color-price",
  ]);

  const qtyEl = firstMatch(row, [
    "input.sc-quantity-textfield",
    "select.a-native-dropdown",
    "input[name*='quantity']",
    "select[name*='quantity']",
  ]);

  const title = titleEl?.textContent?.trim() || "Item";
  const price = priceEl?.textContent?.trim() || null;
  const rawQty = qtyEl?.value ? parseInt(qtyEl.value, 10) : NaN;
  const quantity = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;

  return { title, price, quantity };
}

function parseAmazonCart() {
  const root = getActiveCartRoot();
  const rows = root.querySelectorAll("div[data-asin]:not([data-asin=''])");

  // Dedupe by ASIN: Amazon nests data-asin on more than one element per row
  // in some layouts (the row wrapper and an inner image/link wrapper).
  const seen = new Map();

  rows.forEach((row) => {
    const asin = row.getAttribute("data-asin");
    if (!asin || seen.has(asin)) return;

    const { title, price, quantity } = extractItemDetails(row);
    seen.set(asin, { asin, title, price, quantity });
  });

  return Array.from(seen.values());
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SCRAPE_CART") {
    try {
      const items = parseAmazonCart();
      sendResponse({ ok: true, items, domain: location.hostname });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  }
  return true; // keep the message channel open for the async sendResponse above
});
