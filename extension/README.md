# Shared Cart — Extension

Chrome (Manifest V3) extension that reads your Amazon cart and sends it to the backend to create a share link.

## Load it locally

1. Make sure `web/` is running (`npm run dev` — see `web/README.md`), so `http://localhost:3000` is live.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this `extension/` folder.
5. Go to `amazon.com/gp/cart/view.html` (or `amazon.in`) with items in your cart.
6. Click the Shared Cart icon in your toolbar → **Scan cart & get share link**.

## Files

- `manifest.json` — extension config, permissions, which pages the content script runs on. `host_permissions` must include whatever URL the backend is running at (already set to `http://localhost:3000` for local dev) — without it, requests to the backend can be blocked by CORS.
- `src/content-script.js` — runs on the Amazon cart page, reads item name/ASIN/price/quantity from the DOM. Scoped to the active-cart section only (so "Saved for later" and recommendation carousels never get scraped), deduped by ASIN, and uses fallback selectors since Amazon's markup varies by locale/A-B test.
- `src/popup.html` / `src/popup.js` — the toolbar popup UI that kicks off a scan and shows the resulting link, including the actual error from the backend when something goes wrong.
- `src/background.js` — service worker that posts the scraped items to the backend, with an 8s timeout so it can't hang forever if the backend is unreachable.
- `src/config.js` — points the extension at your backend URL. If you deploy the backend somewhere other than `localhost:3000`, update this **and** the `host_permissions` entry in `manifest.json` to match.

## Notes

- Only runs on the cart page you're already logged into — it never sends credentials anywhere, just the item list.
- Amazon changes their cart page markup occasionally, which can break the selectors in `content-script.js`. If scraping stops finding items, that's the first place to check — `firstMatch()` already tries a few known variants before giving up.
