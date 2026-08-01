# Shared Cart

Share your Amazon cart with a family member so they can buy the items on their own account.

## How it works

1. You add items to your Amazon cart as normal.
2. Our browser extension reads your cart (name, ASIN, quantity, price) and sends it to a share link.
3. You send that link to a family member (text, WhatsApp, email — whatever).
4. They open the link, review the items, and tap **"Add all to my cart"**.
5. That button uses Amazon's own public bulk-add endpoint to drop every item straight into *their* cart, under *their* login. They check out normally.

No passwords or sessions are ever shared. The extension only ever reads the cart of the browser it's installed in, and the recipient only ever adds items to their own account.

## Project structure

```
shared-cart/
├── extension/   # Chrome (Manifest V3) extension that scrapes the sender's cart
└── web/         # Next.js app: API to store shared carts + the page recipients open
```

## Status

Early build. See `extension/README.md` and `web/README.md` for setup instructions for each piece.

## Roadmap

- [x] Extension: scrape cart, send to backend, get share link
- [x] Web: API to store/fetch shared carts
- [x] Web: share page with bulk "add to cart" action
- [x] Persistent storage (JSON file) instead of pure in-memory
- [x] Link expiry (14 days)
- [ ] Real database (SQLite/Postgres) for multi-instance deploys
- [ ] User accounts + saved family members
- [ ] Support for a second retailer
