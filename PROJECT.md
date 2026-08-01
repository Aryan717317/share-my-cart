# Shared Cart — Project Handoff

This document is written for an AI coding agent (or a human) picking up this
codebase cold. It covers the problem, the product decisions, the exact
architecture, what's implemented and verified, and what to build next.

---

## 1. The problem

Amazon lets you share a *wishlist* or a *registry*, but there is no way to
share your actual *cart* — the specific items + quantities you've picked,
right now — with someone else so they can pay and check out on their own
account. This comes up constantly in families: e.g. a parent builds a cart
of things they want, and an adult child wants to just buy it for them
without re-finding every item.

There is no official Amazon API for this. The product exists to close that
gap using two legitimate, non-scraping-credentials mechanisms (see §3).

## 2. Product decisions already made

- **Scope: Amazon only for the MVP.** Not multi-retailer. Validate the core
  loop on one platform before generalizing.
- **This is a real product to launch**, not a hackathon demo — code should
  be written with that bar in mind (input validation, error handling,
  persistence), even though several pieces are intentionally still MVP-grade
  (see §7, Known Limitations).
- **No credential sharing, ever.** The sender's extension only reads DOM
  that's already rendered in their own logged-in browser. The recipient's
  "add to cart" action uses a public, unauthenticated Amazon endpoint that
  operates on *their own* browser session. At no point does any part of this
  system see, store, or transmit anyone's Amazon password, cookies, or
  session tokens. Keep it this way — it's both a security requirement and
  the reason this doesn't violate Amazon's terms the way a
  credential-sharing approach would.

## 3. How it works (the core mechanism)

Two separate, independently-understandable steps:

### Step A — Reading the sender's cart

Amazon has no API to read a cart. So a **browser extension** (Manifest V3,
Chrome) runs a content script on `amazon.com/gp/cart/view.html` /
`amazon.in/gp/cart/view.html`, reads the already-rendered DOM (item title,
ASIN, price, quantity) for rows inside the active-cart container, and hands
that list to a popup UI, which posts it to the backend. This is the same
technique cashback/coupon extensions (Honey, Capital One Shopping, Rakuten)
use to read your own cart — it's reading data the user already has access
to in their own browser, not accessing anyone else's account.

### Step B — Adding to the recipient's cart

Amazon's Associates program has a **documented, public, unauthenticated
endpoint**:

```
https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=XXXX&Quantity.1=2&ASIN.2=YYYY&Quantity.2=1
```

Opening this URL adds those ASIN/quantity pairs to the cart of *whoever's
browser* opens it, using that browser's own Amazon session. No login,
cookies, or credentials are read or passed by our system — Amazon handles
auth entirely on their end. This is the mechanism behind the "Add all N to
my cart" button on the share page.

**This is the single most important technical fact about this project.**
Everything else is UI and plumbing around these two steps.

## 4. Architecture

```
┌─────────────────────┐      scrape DOM       ┌──────────────────┐
│ Sender's Amazon cart │ ───────────────────►  │ content-script.js│
│  (their own browser) │                       │  (extension)     │
└─────────────────────┘                       └────────┬─────────┘
                                                          │ chrome.runtime message
                                                          ▼
                                                ┌──────────────────┐
                                                │  popup.js/html   │  UI: "Scan cart &
                                                │  (extension)     │  get share link"
                                                └────────┬─────────┘
                                                          │ chrome.runtime message
                                                          ▼
                                                ┌──────────────────┐
                                                │  background.js   │  service worker,
                                                │  (extension)     │  fetch() w/ 8s timeout
                                                └────────┬─────────┘
                                                          │ POST /api/cart
                                                          ▼
                                                ┌──────────────────┐
                                                │  Next.js backend  │  validates, clamps,
                                                │  (web/)           │  merges, persists
                                                └────────┬─────────┘
                                                          │ returns { token, shareUrl }
                                                          ▼
                                             share link sent via text/chat/email
                                                          │
                                                          ▼
                                                ┌──────────────────┐
                                                │  Recipient opens  │  GET /cart/[token]
                                                │  share page (web) │  renders items
                                                └────────┬─────────┘
                                                          │ click "Add all to my cart"
                                                          ▼
                                                ┌──────────────────┐
                                                │ amazon.com/gp/aws │  Amazon's own public
                                                │ /cart/add.html    │  bulk-add endpoint
                                                └────────┬─────────┘
                                                          ▼
                                             items land in recipient's own
                                             Amazon cart, under their login
```

## 5. Repo layout

```
shared-cart/
├── PROJECT.md              ← this file
├── README.md                root overview + roadmap
├── extension/                Chrome MV3 extension (sender side)
│   ├── manifest.json          permissions, content script matches, icons
│   ├── README.md
│   ├── icons/                 16/48/128px placeholder icons (generated, replace with real branding)
│   └── src/
│       ├── content-script.js  scrapes the active-cart DOM, deduped, fallback selectors
│       ├── popup.html         toolbar popup UI
│       ├── popup.js           triggers scrape, calls background, shows link/errors
│       ├── background.js      service worker: POSTs to backend, 8s timeout
│       └── config.js          API_BASE_URL constant — points extension at backend
└── web/                      Next.js 14 app (App Router), backend + recipient UI
    ├── README.md
    ├── package.json           next 14.2.5, react 18.3.1, typescript 5.5.4
    ├── .env.example            NEXT_PUBLIC_BASE_URL
    ├── app/
    │   ├── layout.tsx / globals.css / page.tsx  (page.tsx is just an explainer — not the real entry point)
    │   ├── api/cart/route.ts           POST — create a shared cart (CORS handled here)
    │   ├── api/cart/[token]/route.ts   GET  — fetch a shared cart as JSON
    │   └── cart/[token]/page.tsx       the actual recipient-facing share page
    └── lib/
        ├── store.ts            data layer: validation, dedupe, persistence, expiry
        └── amazon.ts           builds the bulk add-to-cart URL + single-item fallback URL
```

## 6. Data model & API contract

```ts
type CartItem = {
  asin: string;        // validated: /^[A-Z0-9]{10}$/i
  title: string;
  price: string | null;
  quantity: number;    // clamped server-side to 1–99
};

type SharedCart = {
  token: string;        // 8-char base64url, from crypto.randomBytes(6)
  domain: string;       // "www.amazon.com" or "www.amazon.in" — determines which Amazon TLD the add-to-cart link targets
  items: CartItem[];
  createdAt: number;    // epoch ms — used for the 14-day expiry check
};
```

**`POST /api/cart`**
Request: `{ items: CartItem[], domain?: string }`
Response `201`: `{ token: string, shareUrl: string }`
Response `400`: `{ error: string }` — empty items array, >50 items, or all items failed ASIN validation
CORS: `Access-Control-Allow-Origin: *`, handles `OPTIONS` preflight (see `route.ts`)

**`GET /api/cart/[token]`**
Response `200`: the `SharedCart` object
Response `404`: `{ error: "not found" }` — unknown token, or the cart expired

**`GET /cart/[token]`** (not an API route — the actual HTML page)
Renders the item list + an "Add all N to my cart" link built by
`buildBulkAddToCartUrl()`, plus a per-item "Add this one" fallback link
built by `buildSingleItemUrl()`. Calls `next/navigation`'s `notFound()` →
Next.js 404 page if the token doesn't resolve.

## 7. What's implemented and verified (as of this handoff)

Everything below was actually built, and the specific behaviors marked
**(tested)** were exercised with real `curl` requests against a running
`next build && next start` server, not just read through and assumed
correct.

- Extension scrapes the active-cart section only (not saved-for-later /
  recommendations), with fallback CSS selectors for title/price/quantity
  across Amazon's markup variants, deduped by ASIN.
- Extension → backend call has an 8s timeout and surfaces the backend's
  actual error message in the popup UI.
- `host_permissions` includes the backend origin (`localhost:3000` for
  dev) so the CORS bypass Chrome grants for host-permitted origins applies;
  the API also sends its own CORS headers and handles `OPTIONS` as a second
  line of defense. **(tested: preflight returns 204 with correct headers)**
- Server-side validation: ASIN shape-checked, quantity clamped 1–99, max 50
  items per request. **(tested: invalid ASIN silently dropped, 60-item
  payload returns 400)**
- Duplicate ASINs in a single request are merged by summing quantity, so
  the Amazon bulk-add URL never lists one product under two indices.
  **(tested: two entries of the same ASIN with qty 2 and 50 merged into one
  entry with qty 52)**
- Backend returns the full `shareUrl` (built from `NEXT_PUBLIC_BASE_URL`)
  rather than the extension reconstructing it from a separately-configured
  constant — single source of truth.
- Shared carts persist to `web/data/carts.json` (gitignored) and survive a
  server restart. **(tested: created a cart, killed the process, restarted,
  fetched it successfully)**
- Shared carts expire 14 days after creation; expired entries are pruned on
  load and the next time any cart is written. **(tested: seeded an
  artificially 20-day-old cart, confirmed 404 on read, confirmed it was
  removed from disk on the next write)**
- Clean install (`rm -rf node_modules .next data && npm install && npm run
  build`) succeeds with no errors as of the last commit.

## 8. Known limitations (intentional, not oversights)

These were left out on purpose for the MVP and are the natural next things
to build:

1. **No auth on share links.** Anyone with the URL can view that cart.
   Fine for "text the link to your mom," not fine as a real product surface.
2. **No user accounts.** No login, no saved family members, no history of
   sent/received carts.
3. **Storage is a single JSON file, not a real database.** Works for one
   server instance; will not work behind a load balancer or with more than
   one process writing to it (`web/data/carts.json`, protected by nothing —
   concurrent writes could race). Swap `web/lib/store.ts` for
   Postgres/SQLite, keeping `createSharedCart` / `getSharedCart` as the
   interface so nothing else has to change.
4. **Amazon only.** No Flipkart/Walmart/other retailer support. The
   `domain` field and the `buildBulkAddToCartUrl` / `buildSingleItemUrl`
   split in `lib/amazon.ts` were written to make adding a second retailer
   mostly a matter of adding a new URL-builder + new content-script
   selectors, but nothing else has been generalized.
5. **No rate limiting** beyond the 50-item cap per request — no protection
   against someone hammering `POST /api/cart` to fill up disk space with
   carts.
6. **Extension icons are placeholder** (generated solid-color circles) —
   need real branding before a Chrome Web Store submission.
7. **No automated test suite.** Verification so far has been manual
   `curl`-based smoke testing (see §7) plus `tsc --noEmit` and `next build`.
   There is no CI, no Jest/Vitest, no Playwright.
8. **Amazon DOM fragility.** `content-script.js` has fallback selectors but
   will still break if Amazon does a significant redesign — there's no
   automated way to detect this except a user reporting "scan found 0
   items."

## 9. Suggested next steps, roughly in priority order

1. **Swap the JSON file store for a real database.** This is the highest-
   leverage change before anything resembling a real launch — the
   interface in `lib/store.ts` is already isolated for this.
2. **Add minimal auth** (even just magic-link email) so share links can be
   scoped to "carts I've received" instead of being unauthenticated-by-URL.
3. **Add a test suite** for `lib/store.ts` (validation/clamp/merge/expiry
   logic) and `lib/amazon.ts` (URL building) — these are pure functions and
   cheap to test, and they're the parts most likely to silently regress.
4. **Deploy the web app somewhere real** (Vercel is the path of least
   resistance for Next.js) and update `NEXT_PUBLIC_BASE_URL`, the
   extension's `config.js`, and `manifest.json` `host_permissions`
   accordingly.
5. **Submit the extension to the Chrome Web Store** — needs real icons, a
   privacy policy page (should explicitly state it never reads or
   transmits credentials — see §2), and store listing copy.
6. Only after the above: multi-retailer support, price-drop tracking, or
   other feature expansion.

## 10. How to run it locally

```bash
# Backend + share pages
cd web
npm install
npm run dev          # http://localhost:3000

# Extension
# chrome://extensions → enable Developer mode → Load unpacked → select extension/
# Then open amazon.com/gp/cart/view.html with items in your cart and click the toolbar icon.
```

Full commit history (`git log --oneline --reverse`) tells the build story
in order — scaffold → extension → backend → share page → verification
build → a full pass of bug fixes and hardening (scraping scope, CORS,
timeouts, validation, dedupe, persistence, expiry). Reading the commits in
order is a reasonable way to understand how the pieces fit together if the
prose above isn't enough.
