# Shared Cart — Web

Next.js app with two jobs:

1. **API** (`app/api/cart`) — receives the scraped cart from the extension, stores it, returns a share token.
2. **Share page** (`app/cart/[token]`) — what the recipient opens: shows the items and an "Add all to my cart" button.

## Run it locally

```bash
npm install
npm run dev
```

Runs at `http://localhost:3000`. Point the extension's `src/config.js` at this URL (already the default for local dev).

## How the "add to cart" button works

`lib/amazon.ts` builds a link to Amazon's own public bulk-add endpoint:

```
https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=XXXX&Quantity.1=2&ASIN.2=YYYY&Quantity.2=1
```

This is a documented part of the Amazon Associates program — opening it adds those ASINs to the cart of *whoever's browser* opens the link, using their own session. We never see or handle their login.

## What the store does before saving a cart

`lib/store.ts` doesn't trust the payload as-is:

- Rejects anything that isn't a real-shaped ASIN (10 alphanumeric characters), regardless of what validation happened upstream in the route handler.
- Clamps quantity to 1–99.
- Merges duplicate ASINs by summing quantity, so the bulk-add URL never lists the same product twice.
- Caps a single request at 50 items (`app/api/cart/route.ts`).

## CORS

The extension calls the API from a `chrome-extension://` origin. `host_permissions` in the extension's `manifest.json` is the primary fix for that, but the API also sends CORS headers and handles `OPTIONS` preflight itself as a second line of defense — so it still works even if the manifest and the deployed backend URL ever drift out of sync.

## Persistence and expiry

Shared carts are stored in `data/carts.json` (gitignored), so they survive a server restart — this is fine for local dev or a single small server, but won't work once you run more than one instance behind a load balancer; swap `lib/store.ts` for Postgres/SQLite at that point, keeping `createSharedCart`/`getSharedCart` as the interface.

Links expire 14 days after creation. Expired carts are pruned on load and the next time any cart is created — an expired cart still on disk from before a restart won't come back, and gets cleaned out of the file automatically.

## Current limitations

- **No auth** — anyone with a share link can view that cart. Fine for an MVP, not for launch.
- **Single instance only**, per the persistence note above.
